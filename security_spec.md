# SakayZone Firestore Security Spec (Phase 0)

## Data Invariants
1. **No PII Exposure**: Public transit collections (`community_zones`, `zone_status_reports`, `vehicle_sightings`, `live_trips`, `waiting_checkins`) never store email addresses, phone numbers, or home addresses.
2. **Verified Author Ownership**: Every created record must stamp `request.auth.uid` as the author/reporter/driver/user UID and require `request.auth.token.email_verified == true`.
3. **Document ID Hardening**: All document IDs (`zoneId`, `sightingId`, `tripId`, `checkinId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars.
4. **Strict Payload Keys & Bounds**: Every create validates exact required/allowed keys (`hasAll` + `hasOnly`), string lengths, numeric coordinate ranges, and enum allowlists.
5. **Server Timestamp Integrity**: `createdAt` and `updatedAt` must equal `request.time`; `createdAt` and author UIDs are immutable on updates.
6. **Single-Record Per User for Live GPS & Check-ins**: `live_trips/{tripId}` and `waiting_checkins/{checkinId}` enforce `docId == request.auth.uid` to prevent spam flooding.
7. **Rule-Enforced Public Queries**: `allow get` and `allow list` require `resource.data.isPublic == true`.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated write to `/community_zones/z1` (`request.auth == null`).
2. Unverified email user writing to `/vehicle_sightings/s1` (`email_verified == false`).
3. Identity spoofing: setting `authorUid: "other-user"` on `/community_zones/z2`.
4. Shadow field injection: adding `isVerified: true` on `/community_zones/z3`.
5. Oversized string DoS: `name` of 5,000 chars on `/community_zones/z4`.
6. Invalid ID poisoning: doc ID containing spaces or special chars (`../bad`).
7. Timestamp spoofing: setting `createdAt` to client date instead of `request.time`.
8. Immutable field tampering: updating `authorUid` or `createdAt` on `/community_zones/z1`.
9. Cross-user GPS overwrite: User B updating `/live_trips/{userA_uid}`.
10. Cross-user check-in spam: User B creating `/waiting_checkins/arbitrary_id` (`checkinId != request.auth.uid`).
11. Invalid enum poisoning: setting `type: "helicopter"` on `/vehicle_sightings/s2`.
12. Querying private docs (`isPublic: false`) via `list`.
