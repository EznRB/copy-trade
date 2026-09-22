SELECT count(*) AS total, count(DISTINCT signature) AS sigs_unicas, min("receivedAt") AS primeiro, max("receivedAt") AS ultimo FROM "ObservedEvent";
SELECT "eventType", count(*) FROM "ObservedEvent" GROUP BY 1;
