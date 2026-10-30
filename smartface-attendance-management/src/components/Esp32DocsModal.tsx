import React, { useState } from 'react';
import { X, Code2, Copy, Check, Cpu, Radio, Shield } from 'lucide-react';

interface Esp32DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceTokenExample?: string;
}

export const Esp32DocsModal: React.FC<Esp32DocsModalProps> = ({
  isOpen,
  onClose,
  deviceTokenExample = 'tok_gate_a_9921_secret',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sampleCppCode = `// =================================================================
// SmartFace ESP32-CAM Hardware Firmware Integration
// Target: AI-Thinker ESP32-CAM / ESP32-S3 Eye
// Library: Arduino / ESP-IDF HTTPClient
// =================================================================
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "https://your-smartface-domain.run.app/api/v1/devices/events";
const char* heartbeatUrl = "https://your-smartface-domain.run.app/api/v1/devices/heartbeat";
const char* deviceToken = "${deviceTokenExample}";

void sendAttendanceEvent(const char* personBadge, float confidence, const char* direction) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Token", deviceToken);

    StaticJsonDocument<256> doc;
    doc["personId"] = personBadge;          // e.g. "SF-1001"
    doc["confidenceScore"] = confidence;    // e.g. 0.965
    doc["direction"] = direction;           // "entry" or "exit"
    doc["captureTimestamp"] = "2026-10-21T08:52:14.000Z";

    String requestBody;
    serializeJson(doc, requestBody);

    int httpCode = http.POST(requestBody);
    if (httpCode > 0) {
      String response = http.getString();
      Serial.printf("[SmartFace] Event Sent! Response Code: %d\\n", httpCode);
      Serial.println(response);
    } else {
      Serial.printf("[SmartFace] Error on sending POST: %s\\n", http.errorToString(httpCode).c_str());
    }
    http.end();
  }
}

void sendHeartbeat() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(heartbeatUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Token", deviceToken);

    StaticJsonDocument<128> doc;
    doc["firmwareVersion"] = "v1.4.2-esp32cam";
    doc["rssi"] = WiFi.RSSI();
    doc["ipAddress"] = WiFi.localIP().toString();

    String body;
    serializeJson(doc, body);
    http.POST(body);
    http.end();
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sampleCppCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              ESP32-CAM API Gateway Specifications & Arduino C++ Code
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <span>
              <strong>Authentication:</strong> All hardware devices authenticate via the HTTP Header <code className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded">X-Device-Token: &lt;token&gt;</code>. Never hardcode backend master keys on microcontroller flash.
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Sample Production C++ Firmware (Arduino / PlatformIO)
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition text-[11px] font-medium cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard' : 'Copy C++ Code'}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
            {sampleCppCode}
          </pre>
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
