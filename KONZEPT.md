# Gildenstadt: Konzept

Stand: 09.11.2026. Konzept für den Prototyp, ohne Code.

## Spielidee

Eine Handelsgilde gründet und entwickelt eine Stadt. Du produzierst Waren, handelst auf dem Markt, erfüllst Aufträge und erforschst Technologien. Ziel ist der höchste Gildenrang. Der Ruf entscheidet, und Rivalengilden konkurrieren mit dir darum.

Eine Partie dauert etwa 15 bis 20 Minuten, rundenbasiert, eine Runde entspricht einer Woche.

## Stadt und Produktion

- Das Raster startet mit 12 Bauplätzen und wächst durch Forschung auf 16 und 20 Plätze.
- Gebäude produzieren oder verbrauchen Waren: Sägewerk, Mine, Feld, Schmiede, Bäckerei, Weberei, Schreibstube, Werkstatt.
- Rohstoffe: Holz, Erz, Getreide. Veredelt: Werkzeug, Brot, Tuch. Währung: Gold.
- Fehlt ein Rohstoff, steht das Gebäude still.

## Bevölkerung und Zufriedenheit

- Einwohner brauchen Brot (1 pro 4 Einwohner) und Tuch (1 pro 6 Einwohner) pro Runde.
- Zufriedenheit startet bei 70. Fehlendes Brot kostet 3 Punkte, fehlendes Tuch 1 Punkt pro Runde. Volle Versorgung bringt +3 bzw. +2.
- Die Bevölkerung wächst nur bei voller Versorgung und Zufriedenheit ab 60. Sie schrumpft erst unter 10.
- Startbestand: 2 Brot, 2 Tuch.

## Markt

- Kaufen treibt den Preis um 5 % hoch, Verkaufen senkt ihn um 5 %.
- Die Preise erholen sich pro Runde um 10 % Richtung Grundpreis.
- Verkaufspreis: 80 % des Marktpreises.

## Aufträge

- Drei Aufträge sind gleichzeitig offen. Jeder verlangt eine bestimmte Menge einer Ware.
- Belohnung: Gold und Ruf. Der Ruf-Wert steigt mit der Menge.
- Pro Runde verschwindet der älteste Auftrag, ein neuer kommt dazu.

## Forschung

- **Wissen** ist eine eigene Ressource, die nur Gebäude erzeugen. Die Schreibstube (Gold 40, Holz 4) verbraucht 1 Holz und liefert 2 Wissen pro Runde.
- Zwölf Technologien in drei Zweigen mit je vier Stufen. Kosten pro Stufe: 2, 4, 6 und 9 Wissen.
- Jede Stufe bringt einen kleinen Effekt und ein Gildenrecht.

**Handwerk:** I Werkstatt (Gebäude, Werkzeug aus Holz), II Zunftrecht (+1 Werkzeug der Schmiede), III Meisterbriefe (Schmiede braucht 1 Erz weniger), IV Werkbank-Netz (+1 Werkzeug der Werkstatt).

**Handel:** I Kontor (Verkaufspreis 90 % statt 80 %), II Handelsbriefe (vierter Auftrag gleichzeitig), III Karawanen (+25 % Gold aus Aufträgen), IV Handelsmonopol (ein gewähltes Gut bleibt preisstabil).

**Verwaltung:** I Gildenhaus (+1 Zufriedenheit pro Runde), II Stadtrat (16 Plätze), III Stadtplanung (Einwohner-Obergrenze 14), IV Großer Rat (20 Plätze).

## Konkurrenz

- Zwei Rivalengilden mit festem Charakter: **Händler** (greift Aufträge ab, handelt viel), **Handwerker** (verkauft Werkzeug und Tuch, drückt Preise), **Verwalter** (wächst langsamer, sammelt Ruf über Aufträge mit hohem Ruf-Wert).
- Pro Runde und Rivale höchstens: ein Auftrag, eine Marktaktion, ein kleiner Ruf-Zuwachs. Keine Forschung, kein Bauen.
- Rivalen sind im Protokoll und im Rundenbericht sichtbar. Ihre Ruf-Werte stehen in der Kopfzeile.

## Bündnisse

- Mit einer Rivalengilde kann ein Vertrag für fünf Runden geschlossen werden. Sie nimmt dann keine Aufträge, die du erfüllen kannst.
- Gegenleistung je nach Charakter: Händler will Gold, Handwerker will Waren, Verwalter lehnt Bündnisse ab.
- Bricht eine Seite das Bündnis vorzeitig, verliert sie 3 Ruf.

## Sieg und Niederlage

- **Sofortiger Sieg:** Du erreichst 40 Ruf, bevor eine Rivalengilde es tut.
- **Sofortige Niederlage:** Eine Rivalengilde erreicht 40 Ruf zuerst.
- **Zeitlimit:** Nach Runde 20 gewinnt, wer den meisten Ruf hat.
- **Gleichstand:** Gewinnt der Spieler, der die letzte Runde ausgelöst hat.

## Schwierigkeit

Drei Stufen, im Startbildschirm vor der Partie wählbar. Sie ändern nur die Geschwindigkeit der Rivalen.
- **Lehrling:** Rivalen nehmen Aufträge seltener.
- **Geselle:** Ausgewogen.
- **Meister:** Rivalen greifen schneller zu und treiben die Preise stärker.

## Oberfläche

- Reiter: Stadt, Lager, Markt, Aufträge, Forschung.
- Rundenbericht nach jedem Rundenende mit Produktion, Verbrauch, Zufriedenheit, Einwohnern und Rivalen-Ereignissen.
- Vibration als Rückmeldung auf Android-Chrome.

## Prototyp-Umfang

Enthalten: Stadt und Produktion, Bevölkerung, Markt, Aufträge, Forschung mit zwölf Technologien, zwei Rivalen mit Charakter, Bündnisse, drei Schwierigkeitsstufen, Zeitlimit und Sieg-Regeln.

Nicht enthalten: Mehrere Städte, Karte, Multiplayer, Speicherstände, Grafik-Politur, Spionage.

## Offene Punkte

- Balancing der Forschungskosten gegen die Produktion, am besten mit Probe-Runden.
- Ob Bündnisse zu viel Ruhe bringen. Das muss man im Spiel erleben.
- Ob der Verwalter ohne Bündnisse zu schwach ist.
