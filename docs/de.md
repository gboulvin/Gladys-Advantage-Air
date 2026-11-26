# Advantage Air

Steuern Sie Ihre **Advantage Air**-Kanalklimaanlage — Systeme **MyAir**,
**e-zone** und **MyPlace** — aus Gladys. Die Integration kommuniziert über Ihr
**lokales Netzwerk** mit dem Wandtablet des Systems: kein Konto, keine Cloud,
sie funktioniert auch ohne Internet.

## Überblick

Nach der Konfiguration findet die Integration alle Geräte des Systems:

- **Klimaanlagen**: Ein/Aus, Modus (Kühlen, Heizen, Lüften, Entfeuchten und
  MyAuto, falls verfügbar), Sollwert (16–32 °C), Lüfterstufe (niedrig,
  mittel, hoch, auto / MyFan), Ein- und Ausschalttimer (Minuten), Frischluft,
  falls vorhanden.
- **Zonen**: Öffnen / Schließen, Öffnung (5–100 %) der Zonen ohne
  Temperatursensor; Temperatur, Sollwert, **MyZone**, Sensorsignal und
  Bewegung (falls der Sensor sie erkennt) der Zonen mit Sensor.
- **MyLights**: Ein/Aus und Helligkeit der dimmbaren Leuchten.
- **MyThings**: Jalousien und Garagentore (öffnen / schließen), Leuchten und
  Relais.

## Voraussetzungen

- Ein Advantage-Air-System, dessen Wandtablet die App **MyAir**, **e-zone**
  oder **MyPlace** ausführt. Lassen Sie die App geöffnet: Sie stellt die
  lokale API bereit.
- Tablet und Gladys im **selben lokalen Netzwerk**.
- Eine **feste IP-Adresse** für das Tablet: Reservieren Sie sie in Ihrem
  Router (DHCP-Reservierung).
- Gladys 5.3 oder neuer.

## Konfiguration

1. Ermitteln Sie die IP-Adresse des Tablets (Android-Einstellungen → Über das
   Tablet → Status oder die Geräteliste Ihres Routers).
2. Öffnen Sie in Gladys den Reiter **Konfiguration** der Integration und
   tragen Sie sie unter **IP-Adresse des Tablets** ein. Behalten Sie den Port
   **2025**.
3. Ändern Sie bei Bedarf das **Aktualisierungsintervall** (standardmäßig 15
   Sekunden, 5 bis 300).
4. Speichern Sie und klicken Sie auf **Verbindung testen**: Die Integration
   listet die gefundenen Klimaanlagen, Zonen, Leuchten und MyThings auf.
5. Öffnen Sie den Reiter **Erkennung** und fügen Sie die gewünschten Geräte
   hinzu.

## Szenen

- Auslöser: **Klimaanlage ein- oder ausgeschaltet**, **Klimamodus geändert**,
  **Filter muss gereinigt werden**, **Fehler der Klimaanlage**, **Zone
  geöffnet oder geschlossen**, **Bewegung in einer Zone erkannt**. Die
  Details sind in den folgenden Aktionen lesbar, z. B.
  `{{triggerEvent.data.error_code}}`.
- Aktionen: **Klimaanlage steuern** (Betrieb, Modus, Lüfter und Sollwert in
  einem Befehl), **Zone steuern**, **Alle Zonen öffnen oder schließen**,
  **MyZone festlegen**, **Timer einstellen** (0 Minuten bricht ab).

## Dashboard

- Widget **Klimaanlage**: Sollwert und MyZone-Temperatur (live), Betrieb,
  Modus, Lüfter, Filter, Fehler und Timer, mit einer Ein/Aus-Taste.
- Widget **Zonen**: Zustand, Öffnung und Temperatur jeder Zone, mit Tasten,
  um alle zu öffnen oder zu schließen.

## Fehlerbehebung

- **„Das Advantage-Air-Tablet antwortet nicht“**: Prüfen Sie, ob das Tablet
  eingeschaltet und die App geöffnet ist und ob sich die Adresse nicht
  geändert hat. Öffnen Sie `http://<Tablet-Adresse>:2025/getSystemData` in
  einem Browser im selben Netzwerk: Es sollte ein JSON-Dokument erscheinen.
- **Eine Änderung springt auf den vorherigen Wert zurück**: Das Gerät hat sie
  abgelehnt. Die Integration zeigt immer den vom Tablet bestätigten Zustand.
- **Sicherheit**: Die lokale API des Tablets hat kein Passwort. Geben Sie
  Port 2025 niemals im Internet frei.
