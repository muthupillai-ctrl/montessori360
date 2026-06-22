/*
 * Montessori360 — RFID Attendance Reader
 * Hardware: ESP32 + RC522 (SPI)
 *
 * Wiring (ESP32 DevKit):
 *   RC522  →  ESP32
 *   SDA    →  GPIO 5   (SS)
 *   SCK    →  GPIO 18
 *   MOSI   →  GPIO 23
 *   MISO   →  GPIO 19
 *   RST    →  GPIO 22
 *   GND    →  GND
 *   3.3V   →  3.3V
 *
 *   Green LED  →  GPIO 25 (via 220Ω resistor)
 *   Red LED    →  GPIO 26 (via 220Ω resistor)
 *   Buzzer     →  GPIO 27 (active piezo)
 *
 * Libraries (install via Arduino Library Manager):
 *   - MFRC522 by GithubCommunity
 *   - ArduinoJson by Benoit Blanchon
 *   - WiFi (built-in with ESP32 board package)
 *   - HTTPClient (built-in with ESP32 board package)
 */

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── Configuration — edit these ──────────────────────────────────────────────

const char* WIFI_SSID     = "YOUR_SCHOOL_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_SCHOOL_WIFI_PASSWORD";

// API key from Montessori360 → RFID Attendance → Readers → Add Reader
const char* DEVICE_API_KEY = "rfid_YOUR_DEVICE_API_KEY_HERE";

// Your school's API URL (no trailing slash)
const char* API_URL = "https://your-school.montessori360.com/api/v1/rfid/tap";

// ── Pin definitions ──────────────────────────────────────────────────────────

#define SS_PIN    5
#define RST_PIN   22
#define LED_GREEN 25
#define LED_RED   26
#define BUZZER    27

// ── Globals ──────────────────────────────────────────────────────────────────

MFRC522 rfid(SS_PIN, RST_PIN);

// Debounce: ignore the same card tapped within this many ms
#define DEBOUNCE_MS 3000
String  lastUid      = "";
unsigned long lastMs = 0;

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED,   OUTPUT);
  pinMode(BUZZER,    OUTPUT);

  // Startup blink
  digitalWrite(LED_RED, HIGH); delay(200); digitalWrite(LED_RED, LOW);
  delay(100);
  digitalWrite(LED_GREEN, HIGH); delay(200); digitalWrite(LED_GREEN, LOW);

  SPI.begin();
  rfid.PCD_Init();

  Serial.println("[RFID] Reader initialised");
  connectWifi();
}

// ── Main loop ─────────────────────────────────────────────────────────────────

void loop() {
  // Reconnect if WiFi dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting…");
    connectWifi();
  }

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  String uid = getUid();
  unsigned long now = millis();

  // Debounce: skip if same card tapped too quickly
  if (uid == lastUid && (now - lastMs) < DEBOUNCE_MS) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }

  lastUid = uid;
  lastMs  = now;

  Serial.print("[RFID] Card UID: ");
  Serial.println(uid);

  sendTap(uid);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ── WiFi connection ──────────────────────────────────────────────────────────

void connectWifi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[WiFi] Connected, IP: ");
    Serial.println(WiFi.localIP());
    blinkGreen(2);
  } else {
    Serial.println("\n[WiFi] Failed to connect");
    blinkRed(3);
  }
}

// ── Read card UID as hex string ──────────────────────────────────────────────

String getUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// ── POST tap to API ──────────────────────────────────────────────────────────

void sendTap(const String& uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] No WiFi — skipping");
    blinkRed(2);
    return;
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("X-Device-Key",  DEVICE_API_KEY);

  StaticJsonDocument<128> doc;
  doc["uid"] = uid;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);

  if (code == 200) {
    String response = http.getString();
    StaticJsonDocument<256> resp;
    DeserializationError err = deserializeJson(resp, response);

    if (!err) {
      const char* status = resp["status"];
      const char* name   = resp["student_name"] | "Unknown";

      Serial.print("[API] status=");
      Serial.print(status);
      Serial.print(" name=");
      Serial.println(name);

      if (strcmp(status, "marked") == 0) {
        beepSuccess();
        blinkGreen(1);
      } else if (strcmp(status, "already_marked") == 0) {
        beepDouble();
        blinkGreen(2);
      } else {
        // unknown_card
        beepError();
        blinkRed(1);
      }
    }
  } else {
    Serial.print("[API] HTTP error: ");
    Serial.println(code);
    blinkRed(2);
  }

  http.end();
}

// ── LED / buzzer helpers ─────────────────────────────────────────────────────

void blinkGreen(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_GREEN, HIGH); delay(150);
    digitalWrite(LED_GREEN, LOW);  delay(100);
  }
}

void blinkRed(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_RED, HIGH); delay(150);
    digitalWrite(LED_RED, LOW);  delay(100);
  }
}

void beepSuccess() {
  // Single long beep — student marked present
  tone(BUZZER, 1000, 200);
  delay(250);
}

void beepDouble() {
  // Two short beeps — already marked
  tone(BUZZER, 1000, 100); delay(150);
  tone(BUZZER, 1000, 100); delay(150);
}

void beepError() {
  // Low tone — unknown card
  tone(BUZZER, 400, 400);
  delay(450);
}
