import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {auth, db, handleFirestoreError, OperationType} from '../firebase';
import type {
  CommunityZoneRecord,
  LiveGpsTripRecord,
  LoadingZone,
  VehicleSightingRecord,
  VehicleType,
  WaitingCheckinRecord,
  ZoneRuleType,
  ZoneStatus,
  ZoneStatusReportRecord,
} from '../types/transit';

function sanitizeDocId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length >= 2 ? cleaned : `id_${Date.now()}`;
}

function clampString(raw: string, maxLen: number, fallback = ''): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}

function getSafeDisplayName(): string {
  const raw = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Commuter';
  return clampString(raw, 60, 'Commuter');
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'number') return ts;
  return Date.now();
}

export function subscribeCommunityZones(
  onData: (zones: CommunityZoneRecord[]) => void,
  onStatusError?: (err: Error) => void
): Unsubscribe {
  const path = 'community_zones';
  const q = query(collection(db, path), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CommunityZoneRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          name: String(data.name ?? 'Loading Zone'),
          address: String(data.address ?? ''),
          lat: Number(data.lat ?? 14.5995),
          lng: Number(data.lng ?? 120.9842),
          allowedVehicles: Array.isArray(data.allowedVehicles)
            ? (data.allowedVehicles as VehicleType[])
            : ['jeep', 'bus', 'taxi'],
          ruleType: (data.ruleType as ZoneRuleType) ?? 'loading_unloading',
          status: (data.status as ZoneStatus) ?? 'active',
          landmarkTip: String(data.landmarkTip ?? ''),
          fareRange: String(data.fareRange ?? '₱13 – ₱25'),
          authorUid: String(data.authorUid ?? ''),
          authorName: String(data.authorName ?? 'Commuter'),
          isPublic: Boolean(data.isPublic),
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      onData(list);
    },
    (error) => {
      if (onStatusError) {
        onStatusError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export function subscribeZoneStatusReports(
  onData: (reports: Record<string, ZoneStatusReportRecord>) => void,
  onStatusError?: (err: Error) => void
): Unsubscribe {
  const path = 'zone_status_reports';
  const q = query(collection(db, path), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const map: Record<string, ZoneStatusReportRecord> = {};
      for (const d of snapshot.docs) {
        const data = d.data();
        const zoneId = String(data.zoneId ?? d.id);
        map[zoneId] = {
          zoneId,
          zoneName: String(data.zoneName ?? ''),
          status: (data.status as ZoneStatus) ?? 'active',
          queueNote: String(data.queueNote ?? ''),
          reporterUid: String(data.reporterUid ?? ''),
          reporterName: String(data.reporterName ?? 'Commuter'),
          updatedAtMs: toMillis(data.updatedAt),
        };
      }
      onData(map);
    },
    (error) => {
      if (onStatusError) {
        onStatusError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export function subscribeVehicleSightings(
  onData: (sightings: VehicleSightingRecord[]) => void,
  onStatusError?: (err: Error) => void
): Unsubscribe {
  const path = 'vehicle_sightings';
  const q = query(collection(db, path), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const list: VehicleSightingRecord[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const expiresAtMs = Number(data.expiresAtMs ?? 0);
        if (expiresAtMs <= now) continue;
        list.push({
          id: d.id,
          zoneId: String(data.zoneId ?? ''),
          zoneName: String(data.zoneName ?? ''),
          type: (data.type as VehicleType) ?? 'jeep',
          routeLabel: String(data.routeLabel ?? ''),
          occupancy: (data.occupancy as 'seats' | 'standing' | 'full') ?? 'seats',
          etaMinutes: Number(data.etaMinutes ?? 3),
          zoneLat: Number(data.zoneLat ?? 14.5995),
          zoneLng: Number(data.zoneLng ?? 120.9842),
          reporterUid: String(data.reporterUid ?? ''),
          reporterName: String(data.reporterName ?? 'Commuter'),
          expiresAtMs,
          createdAtMs: toMillis(data.createdAt),
        });
      }
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(list);
    },
    (error) => {
      if (onStatusError) {
        onStatusError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export function subscribeLiveGpsTrips(
  onData: (trips: LiveGpsTripRecord[]) => void,
  onStatusError?: (err: Error) => void
): Unsubscribe {
  const path = 'live_trips';
  const q = query(collection(db, path), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const cutoff = Date.now() - 10 * 60 * 1000;
      const list: LiveGpsTripRecord[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const updatedAtMs = toMillis(data.updatedAt);
        if (!data.active || updatedAtMs < cutoff) continue;
        list.push({
          tripId: d.id,
          driverUid: String(data.driverUid ?? d.id),
          displayName: String(data.displayName ?? 'Driver'),
          type: (data.type as VehicleType) ?? 'jeep',
          routeLabel: String(data.routeLabel ?? ''),
          occupancy: (data.occupancy as 'seats' | 'standing' | 'full') ?? 'seats',
          lat: Number(data.lat ?? 14.5995),
          lng: Number(data.lng ?? 120.9842),
          speedMps: Number(data.speedMps ?? 5),
          heading: Number(data.heading ?? 0),
          active: Boolean(data.active),
          updatedAtMs,
        });
      }
      onData(list);
    },
    (error) => {
      if (onStatusError) {
        onStatusError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export function subscribeWaitingCheckins(
  onData: (checkins: WaitingCheckinRecord[]) => void,
  onStatusError?: (err: Error) => void
): Unsubscribe {
  const path = 'waiting_checkins';
  const q = query(collection(db, path), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const cutoff = Date.now() - 25 * 60 * 1000;
      const list: WaitingCheckinRecord[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const updatedAtMs = toMillis(data.updatedAt);
        if (updatedAtMs < cutoff) continue;
        list.push({
          checkinId: d.id,
          userUid: String(data.userUid ?? d.id),
          zoneId: String(data.zoneId ?? ''),
          zoneName: String(data.zoneName ?? ''),
          vehicleWanted: (data.vehicleWanted as 'all' | VehicleType) ?? 'all',
          updatedAtMs,
        });
      }
      onData(list);
    },
    (error) => {
      if (onStatusError) {
        onStatusError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export async function createCommunityZone(zone: LoadingZone): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in with Google first to save a shared Loading Zone.');

  const zoneId = sanitizeDocId(zone.id);
  const path = `community_zones/${zoneId}`;
  try {
    await setDoc(doc(db, 'community_zones', zoneId), {
      id: zoneId,
      name: clampString(zone.name, 120, 'Loading Zone'),
      address: clampString(zone.address, 160, 'Roadside Loading Bay'),
      lat: Number(zone.location.lat),
      lng: Number(zone.location.lng),
      allowedVehicles: zone.allowedVehicles.slice(0, 3),
      ruleType: zone.ruleType,
      status: zone.status,
      landmarkTip: clampString(zone.landmarkTip, 320, 'Stand safely behind the curb.'),
      fareRange: clampString(zone.fareRange, 60, '₱13 – ₱25'),
      authorUid: uid,
      authorName: getSafeDisplayName(),
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCommunityZone(
  zoneId: string,
  patch: Partial<LoadingZone>,
  isOwner: boolean
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in with Google first to update a Loading Zone.');

  const safeId = sanitizeDocId(zoneId);
  const path = `community_zones/${safeId}`;
  try {
    if (!isOwner) {
      await updateDoc(doc(db, 'community_zones', safeId), {
        status: patch.status ?? 'active',
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.name !== undefined) {
      updatePayload.name = clampString(patch.name, 120, 'Loading Zone');
    }
    if (patch.address !== undefined) {
      updatePayload.address = clampString(patch.address, 160, 'Roadside Bay');
    }
    if (patch.allowedVehicles !== undefined && patch.allowedVehicles.length > 0) {
      updatePayload.allowedVehicles = patch.allowedVehicles.slice(0, 3);
    }
    if (patch.ruleType !== undefined) {
      updatePayload.ruleType = patch.ruleType;
    }
    if (patch.status !== undefined) {
      updatePayload.status = patch.status;
    }
    if (patch.landmarkTip !== undefined) {
      updatePayload.landmarkTip = clampString(patch.landmarkTip, 320, 'Marked loading bay.');
    }
    if (patch.fareRange !== undefined) {
      updatePayload.fareRange = clampString(patch.fareRange, 60, '₱13 – ₱25');
    }

    await updateDoc(doc(db, 'community_zones', safeId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCommunityZone(zoneId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required.');
  const safeId = sanitizeDocId(zoneId);
  const path = `community_zones/${safeId}`;
  try {
    await deleteDoc(doc(db, 'community_zones', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function reportZoneStatus(payload: {
  zoneId: string;
  zoneName: string;
  status: ZoneStatus;
  queueNote: string;
  hasExistingReport: boolean;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in with Google first to report live zone conditions.');

  const safeZoneId = sanitizeDocId(payload.zoneId);
  const path = `zone_status_reports/${safeZoneId}`;
  try {
    if (payload.hasExistingReport) {
      await updateDoc(doc(db, 'zone_status_reports', safeZoneId), {
        status: payload.status,
        queueNote: clampString(payload.queueNote, 180, ''),
        reporterUid: uid,
        reporterName: getSafeDisplayName(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'zone_status_reports', safeZoneId), {
        zoneId: safeZoneId,
        zoneName: clampString(payload.zoneName, 120, 'Loading Zone'),
        status: payload.status,
        queueNote: clampString(payload.queueNote, 180, ''),
        reporterUid: uid,
        reporterName: getSafeDisplayName(),
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function postVehicleSighting(payload: {
  zone: LoadingZone;
  type: VehicleType;
  routeLabel: string;
  occupancy: 'seats' | 'standing' | 'full';
  etaMinutes: number;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in with Google first to report an approaching ride.');

  const sightingId = sanitizeDocId(`sight_${Date.now()}_${uid.slice(0, 8)}`);
  const path = `vehicle_sightings/${sightingId}`;
  const now = Date.now();
  try {
    await setDoc(doc(db, 'vehicle_sightings', sightingId), {
      zoneId: sanitizeDocId(payload.zone.id),
      zoneName: clampString(payload.zone.name, 120, 'Loading Zone'),
      type: payload.type,
      routeLabel: clampString(payload.routeLabel, 120, `${payload.type.toUpperCase()} approaching`),
      occupancy: payload.occupancy,
      etaMinutes: Math.max(1, Math.min(60, Math.round(payload.etaMinutes))),
      zoneLat: Number(payload.zone.location.lat),
      zoneLng: Number(payload.zone.location.lng),
      reporterUid: uid,
      reporterName: getSafeDisplayName(),
      isPublic: true,
      expiresAtMs: now + 15 * 60 * 1000,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function upsertLiveGpsTrip(payload: {
  type: VehicleType;
  routeLabel: string;
  occupancy: 'seats' | 'standing' | 'full';
  lat: number;
  lng: number;
  speedMps: number;
  heading: number;
  isFirstWrite: boolean;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in with Google first to share live GPS.');

  const path = `live_trips/${uid}`;
  const clampedSpeed = Math.max(0, Math.min(60, Number.isFinite(payload.speedMps) ? payload.speedMps : 0));
  const clampedHeading = Math.max(0, Math.min(360, Number.isFinite(payload.heading) ? payload.heading : 0));

  try {
    if (payload.isFirstWrite) {
      await setDoc(doc(db, 'live_trips', uid), {
        driverUid: uid,
        displayName: getSafeDisplayName(),
        type: payload.type,
        routeLabel: clampString(payload.routeLabel, 120, 'Live PUV Route'),
        occupancy: payload.occupancy,
        lat: Number(payload.lat),
        lng: Number(payload.lng),
        speedMps: clampedSpeed,
        heading: clampedHeading,
        active: true,
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'live_trips', uid), {
        displayName: getSafeDisplayName(),
        type: payload.type,
        routeLabel: clampString(payload.routeLabel, 120, 'Live PUV Route'),
        occupancy: payload.occupancy,
        lat: Number(payload.lat),
        lng: Number(payload.lng),
        speedMps: clampedSpeed,
        heading: clampedHeading,
        active: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function stopLiveGpsTrip(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const path = `live_trips/${uid}`;
  try {
    await deleteDoc(doc(db, 'live_trips', uid));
  } catch {
    // Ignore if already deleted
  }
}

export async function upsertWaitingCheckin(payload: {
  zone: LoadingZone;
  vehicleWanted: 'all' | VehicleType;
  hasExisting: boolean;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in with Google first to check in at this Loading Zone.');

  const path = `waiting_checkins/${uid}`;
  try {
    if (payload.hasExisting) {
      await updateDoc(doc(db, 'waiting_checkins', uid), {
        zoneId: sanitizeDocId(payload.zone.id),
        zoneName: clampString(payload.zone.name, 120, 'Loading Zone'),
        vehicleWanted: payload.vehicleWanted,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'waiting_checkins', uid), {
        userUid: uid,
        zoneId: sanitizeDocId(payload.zone.id),
        zoneName: clampString(payload.zone.name, 120, 'Loading Zone'),
        vehicleWanted: payload.vehicleWanted,
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeWaitingCheckin(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await deleteDoc(doc(db, 'waiting_checkins', uid));
  } catch {
    // Ignore if already removed
  }
}
