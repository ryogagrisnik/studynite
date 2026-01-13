-- Add index for leaderboard queries on weekly windows.
CREATE INDEX "PartySubmission_createdAt_partyPlayerId_idx"
ON "PartySubmission"("createdAt", "partyPlayerId");
