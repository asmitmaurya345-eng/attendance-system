/**
 * SmartFace Attendance Engine
 * Core business rules, explicit Asia/Kolkata timezone handling,
 * idempotent writes, multiple punch sessions, duplicate prevention, and absence finalization.
 */

import { db, getTodayDateString } from './db.ts';
import {
  DEFAULT_TIMEZONE,
  getDateStringInTimezone,
  parseDateTimeInTimezone,
  getDayOfWeekInTimezone,
  diffInMinutes,
} from './timezone.ts';
import {
  AttendanceEvent,
  DailyAttendanceSummary,
  DailyStatus,
  EventDirection,
  EventSource,
  PunchSession,
} from '../types/index.ts';

export interface ProcessEventInput {
  clientRequestId?: string;
  personId: string;
  deviceId?: string;
  eventTimestamp?: string; // ISO UTC, defaults to now()
  direction?: EventDirection;
  confidenceScore?: number;
  snapshotUrl?: string;
  source?: EventSource;
  isSimulated?: boolean;
  rawPayload?: Record<string, unknown>;
}

export interface EngineResult {
  event: AttendanceEvent;
  isDuplicate: boolean;
  duplicateReason?: string;
  isIdempotentReplay?: boolean;
  dailySummary?: DailyAttendanceSummary;
  appliedDirection: EventDirection;
}

export class AttendanceEngine {
  /**
   * Process a scan event coming from an ESP32-CAM, Python recognition service, or test simulator.
   */
  public static processScan(input: ProcessEventInput): EngineResult {
    const person = db.getPersonById(input.personId);
    if (!person) {
      throw new Error(`Person with ID '${input.personId}' not found.`);
    }

    // 1. IDEMPOTENT WRITE CHECK
    if (input.clientRequestId) {
      const existing = db.getEventByClientRequestId(input.clientRequestId);
      if (existing) {
        const dateStr = getDateStringInTimezone(new Date(existing.eventTimestamp), DEFAULT_TIMEZONE);
        const summary = db.getDailySummaries(dateStr).find(s => s.personId === person.id);
        return {
          event: existing,
          isDuplicate: existing.isDuplicate,
          duplicateReason: existing.duplicateReason,
          isIdempotentReplay: true,
          dailySummary: summary,
          appliedDirection: existing.direction,
        };
      }
    }

    const settings = db.getSettings();
    const eventTime = input.eventTimestamp ? new Date(input.eventTimestamp) : new Date();
    const eventTimeIso = eventTime.toISOString();

    // Explicit Asia/Kolkata date computation
    const targetTimezone = settings.timezone || DEFAULT_TIMEZONE;
    const dateStr = getDateStringInTimezone(eventTime, targetTimezone);

    // Determine device and configured direction logic
    const device = input.deviceId ? db.getDeviceById(input.deviceId) : undefined;
    let appliedDirection: EventDirection = input.direction || 'unspecified';

    if (device) {
      // Update device last event timestamp & heartbeat
      db.updateDevice(device.id, {
        lastEventAt: eventTimeIso,
        lastHeartbeatAt: eventTimeIso,
        status: device.isSimulated ? 'online' : 'online',
      });

      if (device.direction === 'entry') {
        appliedDirection = 'entry';
      } else if (device.direction === 'exit') {
        appliedDirection = 'exit';
      }
    }

    // If direction still unspecified, check prior events today for automatic alternation
    const todayEvents = db
      .getEvents(100, { personId: person.id, isDuplicate: false })
      .filter(e => getDateStringInTimezone(new Date(e.eventTimestamp), targetTimezone) === dateStr);

    if (appliedDirection === 'unspecified') {
      if (todayEvents.length === 0) {
        appliedDirection = 'entry';
      } else {
        const lastEvt = todayEvents[0]; // Most recent
        appliedDirection = lastEvt.direction === 'entry' ? 'exit' : 'entry';
      }
    }

    // 2. DUPLICATE CHECK: cooldown window check for same person & direction
    const cooldownMs = (settings.cooldownWindowMinutes || 5) * 60 * 1000;
    const recentDuplicate = todayEvents.find(e => {
      const timeDiff = Math.abs(eventTime.getTime() - new Date(e.eventTimestamp).getTime());
      return timeDiff <= cooldownMs && e.direction === appliedDirection;
    });

    const isSimulated = Boolean(input.isSimulated || input.source === 'simulator' || device?.isSimulated);

    if (recentDuplicate) {
      const diffSecs = Math.round(
        Math.abs(eventTime.getTime() - new Date(recentDuplicate.eventTimestamp).getTime()) / 1000
      );
      const duplicateReason = `Duplicate scan detected within ${settings.cooldownWindowMinutes || 5}-min cooldown (${diffSecs}s since previous ${appliedDirection} punch).`;

      const dupEvent = db.addEvent({
        clientRequestId: input.clientRequestId,
        personId: person.id,
        personName: person.fullName,
        personBadge: person.personId,
        department: person.department,
        deviceId: device?.id,
        deviceName: device?.name,
        eventTimestamp: eventTimeIso,
        direction: appliedDirection,
        confidenceScore: input.confidenceScore ?? 0.95,
        snapshotUrl: input.snapshotUrl,
        isDuplicate: true,
        duplicateReason,
        isSimulated,
        source: input.source || (isSimulated ? 'simulator' : 'camera'),
        rawPayload: input.rawPayload,
      });

      db.logAudit({
        userEmail: 'system-engine@smartface.internal',
        userRole: 'super_admin',
        action: 'DUPLICATE_EVENT_PREVENTED',
        targetType: 'attendance_event',
        targetId: dupEvent.id,
        details: { personId: person.personId, duplicateReason, diffSecs, isSimulated },
      });

      return {
        event: dupEvent,
        isDuplicate: true,
        duplicateReason,
        appliedDirection,
      };
    }

    // 3. VALID EVENT: Record into immutable attendance_events
    const validEvent = db.addEvent({
      clientRequestId: input.clientRequestId,
      personId: person.id,
      personName: person.fullName,
      personBadge: person.personId,
      department: person.department,
      deviceId: device?.id,
      deviceName: device?.name,
      eventTimestamp: eventTimeIso,
      direction: appliedDirection,
      confidenceScore: input.confidenceScore ?? 0.95,
      snapshotUrl: input.snapshotUrl,
      isDuplicate: false,
      isSimulated,
      source: input.source || (isSimulated ? 'simulator' : 'camera'),
      rawPayload: input.rawPayload,
    });

    // 4. RECOMPUTE DAILY SUMMARY FOR THIS PERSON AND DATE
    const updatedSummary = this.recomputeDailySummary(person.id, dateStr);

    db.logAudit({
      userEmail: 'attendance-engine@smartface.internal',
      userRole: 'super_admin',
      action: 'SCAN_RECORDED',
      targetType: 'attendance_event',
      targetId: validEvent.id,
      details: {
        personBadge: person.personId,
        direction: appliedDirection,
        status: updatedSummary?.status,
        device: device?.name,
        timezone: targetTimezone,
        isSimulated,
      },
    });

    return {
      event: validEvent,
      isDuplicate: false,
      dailySummary: updatedSummary,
      appliedDirection,
    };
  }

  /**
   * Recompute daily summary from raw events for a person and date with explicit Asia/Kolkata timezone.
   */
  public static recomputeDailySummary(personId: string, dateStr: string): DailyAttendanceSummary {
    const person = db.getPersonById(personId);
    if (!person) {
      throw new Error(`Person ${personId} not found`);
    }

    const schedule = db.getScheduleById(person.scheduleId);
    const timeZone = schedule.timezone || DEFAULT_TIMEZONE;

    // Fetch all non-duplicate events for this day in the designated timezone
    const allEvents = db
      .getEvents(200, { personId: person.id, isDuplicate: false })
      .filter(e => getDateStringInTimezone(new Date(e.eventTimestamp), timeZone) === dateStr)
      .sort((a, b) => new Date(a.eventTimestamp).getTime() - new Date(b.eventTimestamp).getTime());

    // Check holiday first
    const isHoliday = db.getHolidays().some(h => h.date === dateStr);
    if (isHoliday && allEvents.length === 0) {
      const summary: DailyAttendanceSummary = {
        id: `sum-${person.id}-${dateStr}`,
        personId: person.id,
        personName: person.fullName,
        personBadge: person.personId,
        department: person.department,
        date: dateStr,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        totalWorkMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        status: 'holiday',
        isManuallyAdjusted: false,
        isSimulated: false,
        punchSessions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.upsertDailySummary(summary);
      return summary;
    }

    // Check approved leave
    const hasLeave = db.getLeaveRequests().some(l => {
      return (
        l.personId === person.id &&
        l.status === 'approved' &&
        dateStr >= l.startDate &&
        dateStr <= l.endDate
      );
    });

    if (hasLeave && allEvents.length === 0) {
      const summary: DailyAttendanceSummary = {
        id: `sum-${person.id}-${dateStr}`,
        personId: person.id,
        personName: person.fullName,
        personBadge: person.personId,
        department: person.department,
        date: dateStr,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        totalWorkMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        status: 'leave',
        isManuallyAdjusted: false,
        adjustmentReason: 'Approved Leave',
        isSimulated: false,
        punchSessions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.upsertDailySummary(summary);
      return summary;
    }

    // If no events registered
    if (allEvents.length === 0) {
      const summary: DailyAttendanceSummary = {
        id: `sum-${person.id}-${dateStr}`,
        personId: person.id,
        personName: person.fullName,
        personBadge: person.personId,
        department: person.department,
        date: dateStr,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        totalWorkMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        status: 'absent',
        isManuallyAdjusted: false,
        isSimulated: false,
        punchSessions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.upsertDailySummary(summary);
      return summary;
    }

    // Multiple Entry / Exit Pairing
    const punchSessions: PunchSession[] = [];
    let currentInTime: string | null = null;
    let computedWorkMinutes = 0;

    for (const evt of allEvents) {
      if (evt.direction === 'entry') {
        if (!currentInTime) {
          currentInTime = evt.eventTimestamp;
        }
      } else if (evt.direction === 'exit') {
        if (currentInTime) {
          const sessionMin = Math.max(0, diffInMinutes(new Date(evt.eventTimestamp), new Date(currentInTime)));
          computedWorkMinutes += sessionMin;
          punchSessions.push({
            inTime: currentInTime,
            outTime: evt.eventTimestamp,
            minutesWorked: sessionMin,
          });
          currentInTime = null;
        }
      }
    }

    // If an entry is currently open without an exit
    if (currentInTime) {
      const now = new Date();
      let openMin = 0;
      if (getDateStringInTimezone(now, timeZone) === dateStr) {
        openMin = Math.max(0, diffInMinutes(now, new Date(currentInTime)));
      }
      punchSessions.push({
        inTime: currentInTime,
        outTime: undefined, // Never invent missing timestamps!
        minutesWorked: openMin,
      });
      computedWorkMinutes += openMin;
    }

    // Earliest entry is First In
    const entryEvents = allEvents.filter(e => e.direction === 'entry');
    const firstIn = entryEvents.length > 0 ? entryEvents[0].eventTimestamp : allEvents[0].eventTimestamp;

    // Latest exit (if any occurred after firstIn) is Last Out
    const exitEvents = allEvents.filter(
      e => e.direction === 'exit' && new Date(e.eventTimestamp).getTime() > new Date(firstIn).getTime()
    );
    const lastOut = exitEvents.length > 0 ? exitEvents[exitEvents.length - 1].eventTimestamp : undefined;

    // Explicit Asia/Kolkata shift schedule boundaries
    const shiftStartDate = parseDateTimeInTimezone(dateStr, schedule.workStartTime, timeZone);
    const graceCutoff = new Date(shiftStartDate.getTime() + schedule.gracePeriodMinutes * 60 * 1000);
    const firstInDate = new Date(firstIn);

    // Compute late arrival
    let lateMinutes = 0;
    let status: DailyStatus = 'present';

    if (firstInDate.getTime() > graceCutoff.getTime()) {
      status = 'late';
      lateMinutes = Math.round((firstInDate.getTime() - graceCutoff.getTime()) / (60 * 1000));
    }

    // Check half-day threshold
    if (lastOut && computedWorkMinutes < schedule.halfDayThresholdMinutes) {
      status = 'half_day';
    }

    // Check existing manual adjustments
    const existing = db.getDailySummaries(dateStr).find(s => s.personId === person.id);
    if (existing?.isManuallyAdjusted) {
      status = existing.status;
    }

    const hasSimulated = allEvents.some(e => e.isSimulated);

    const summary: DailyAttendanceSummary = {
      id: existing ? existing.id : `sum-${person.id}-${dateStr}`,
      personId: person.id,
      personName: person.fullName,
      personBadge: person.personId,
      department: person.department,
      date: dateStr,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      firstIn,
      lastOut,
      totalWorkMinutes: computedWorkMinutes,
      lateMinutes,
      earlyLeaveMinutes: 0,
      status,
      isManuallyAdjusted: existing?.isManuallyAdjusted || false,
      adjustmentReason: existing?.adjustmentReason,
      adjustedBy: existing?.adjustedBy,
      isSimulated: hasSimulated,
      punchSessions,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.upsertDailySummary(summary);
    return summary;
  }

  /**
   * Finalize absences for active employees on targetDate.
   * NEVER marks an employee absent before the configured shift cutoff!
   */
  public static finalizeAbsences(
    targetDate: string = getTodayDateString(),
    forcePastCutoffCheck = false
  ): {
    finalizedCount: number;
    absentCount: number;
    holidayCount: number;
    leaveCount: number;
    skippedPrematureCount: number;
  } {
    const activePeople = db.getPeople({ status: 'active' });
    const todayInIST = getTodayDateString(DEFAULT_TIMEZONE);
    const now = new Date();

    let absentCount = 0;
    let holidayCount = 0;
    let leaveCount = 0;
    let skippedPrematureCount = 0;

    for (const p of activePeople) {
      const schedule = db.getScheduleById(p.scheduleId);
      const timeZone = schedule.timezone || DEFAULT_TIMEZONE;

      // Check if target day is a scheduled work day (1=Mon ... 7=Sun)
      const dayOfWeek = getDayOfWeekInTimezone(
        parseDateTimeInTimezone(targetDate, '12:00', timeZone),
        timeZone
      );
      if (!schedule.workDays.includes(dayOfWeek)) {
        continue; // Non-working day (weekend/rest day)
      }

      // Check if date is today and whether shift cutoff has passed
      if (targetDate === todayInIST && !forcePastCutoffCheck) {
        const shiftStart = parseDateTimeInTimezone(targetDate, schedule.workStartTime, timeZone);
        // Cutoff is shift start + grace period + 2 hours (cannot mark absent before shift even starts!)
        const cutoffTime = new Date(shiftStart.getTime() + (schedule.gracePeriodMinutes + 120) * 60 * 1000);
        if (now.getTime() < cutoffTime.getTime()) {
          skippedPrematureCount++;
          continue; // Guard: Never mark absent before cutoff!
        }
      }

      const summary = this.recomputeDailySummary(p.id, targetDate);
      if (summary.status === 'absent') absentCount++;
      if (summary.status === 'holiday') holidayCount++;
      if (summary.status === 'leave') leaveCount++;
    }

    db.logAudit({
      userEmail: 'system-engine@smartface.internal',
      userRole: 'super_admin',
      action: 'ABSENCES_FINALIZED',
      targetType: 'daily_attendance',
      details: { targetDate, absentCount, holidayCount, leaveCount, skippedPrematureCount },
    });

    return {
      finalizedCount: activePeople.length - skippedPrematureCount,
      absentCount,
      holidayCount,
      leaveCount,
      skippedPrematureCount,
    };
  }

  /**
   * Admin manual punch correction with audit logging.
   */
  public static manualCorrection(params: {
    personId: string;
    date: string;
    newStatus: DailyStatus;
    reason: string;
    adjustedBy: string;
    firstIn?: string;
    lastOut?: string;
  }): DailyAttendanceSummary {
    const person = db.getPersonById(params.personId);
    if (!person) throw new Error('Person not found');

    const schedule = db.getScheduleById(person.scheduleId);
    const existing = db.getDailySummaries(params.date).find(s => s.personId === person.id);

    const summary: DailyAttendanceSummary = {
      id: existing ? existing.id : `sum-${person.id}-${params.date}`,
      personId: person.id,
      personName: person.fullName,
      personBadge: person.personId,
      department: person.department,
      date: params.date,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      firstIn: params.firstIn !== undefined ? params.firstIn : existing?.firstIn,
      lastOut: params.lastOut !== undefined ? params.lastOut : existing?.lastOut,
      totalWorkMinutes: existing?.totalWorkMinutes || (params.newStatus === 'present' ? 480 : 0),
      lateMinutes: params.newStatus === 'late' ? (existing?.lateMinutes || 30) : 0,
      earlyLeaveMinutes: 0,
      status: params.newStatus,
      isManuallyAdjusted: true,
      adjustmentReason: params.reason,
      adjustedBy: params.adjustedBy,
      isSimulated: existing?.isSimulated || false,
      punchSessions: existing?.punchSessions || [],
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.upsertDailySummary(summary);

    db.logAudit({
      userEmail: params.adjustedBy,
      userRole: 'admin',
      action: 'MANUAL_ATTENDANCE_CORRECTION',
      targetType: 'daily_attendance',
      targetId: summary.id,
      details: {
        personBadge: person.personId,
        date: params.date,
        previousStatus: existing?.status,
        newStatus: params.newStatus,
        reason: params.reason,
      },
    });

    return summary;
  }
}
