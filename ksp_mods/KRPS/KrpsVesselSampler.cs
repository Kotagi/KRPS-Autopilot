using System;
using System.Globalization;
using System.Text;
using UnityEngine;

namespace KRPS {
    /// <summary>
    /// Samples vessel attitude using kRPC SpaceCenter surface/vessel reference frames.
    /// </summary>
    internal static class KrpsVesselSampler {
        public static string BuildTelemetryJson(Vessel vessel, long seq) {
            KrpsAttitude attitude = Sample(vessel);
            long tsMs = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;

            var sb = new StringBuilder(384);
            sb.Append('{');
            AppendField(sb, "seq", seq, true);
            AppendField(sb, "ts_ms", tsMs, false);
            AppendField(sb, "pitch_deg", attitude.PitchDeg, false);
            AppendField(sb, "roll_deg", attitude.RollDeg, false);
            AppendField(sb, "heading_deg", attitude.HeadingDeg, false);
            AppendArray(sb, "surface_rotation", attitude.SurfaceRotation, false);
            AppendArray(sb, "prograde", attitude.Prograde, false);
            AppendField(sb, "surface_speed_ms", attitude.SurfaceSpeedMs, false);
            AppendField(sb, "orbital_speed_ms", attitude.OrbitalSpeedMs, false);
            AppendField(sb, "debug_heading_nose_deg", attitude.HeadingNoseDeg, false);
            AppendField(sb, "debug_heading_bottom_deg", attitude.HeadingBottomDeg, false);
            AppendField(sb, "debug_ksp_heading_deg", attitude.KspHeadingDeg, false);
            AppendString(sb, "vessel_name", vessel.vesselName, false);
            sb.Append('}');

            if (seq % 250 == 0) {
                Debug.Log(
                    "[KRPS] sample seq=" + seq +
                    " hdg=" + attitude.HeadingDeg.ToString("F1", CultureInfo.InvariantCulture) +
                    " bottom=" + attitude.HeadingBottomDeg.ToString("F1", CultureInfo.InvariantCulture) +
                    " pitch=" + attitude.PitchDeg.ToString("F1", CultureInfo.InvariantCulture) +
                    " roll=" + attitude.RollDeg.ToString("F1", CultureInfo.InvariantCulture) +
                    " quat=" + FormatQuat(attitude.SurfaceRotation)
                );
            }

            return sb.ToString();
        }

        public static KrpsAttitude Sample(Vessel vessel) {
            KrpsQuatD surfaceFrame = KrpsKrpcMath.SurfaceFrameRotation(vessel);
            KrpsQuatD vesselFrame = KrpsKrpcMath.VesselFrameRotation(vessel);
            KrpsQuatD vesselToSurface = KrpsKrpcMath.RotationFromWorldSpace(
                surfaceFrame,
                vessel.ReferenceTransform.rotation
            );
            Vector3d phr = KrpsKrpcMath.PitchHeadingRoll(vesselToSurface);

            Vector3d worldVelocity = KrpsKrpcMath.WorldVelocity(vessel);
            Vector3d frameVelocity = worldVelocity;
            Vector3d surfaceVelocity = KrpsKrpcMath.VelocityFromWorldSpace(
                surfaceFrame,
                frameVelocity,
                worldVelocity
            );
            double speed = surfaceVelocity.magnitude;
            Vector3d radialUp = (vessel.CoM - vessel.mainBody.position).normalized;
            Vector3d surfaceUp = KrpsKrpcMath.DirectionFromWorldSpace(surfaceFrame, radialUp);
            double verticalSpeed = Vector3d.Dot(surfaceVelocity, surfaceUp);
            double horizontalSpeed = Math.Sqrt(Math.Max(0.0, speed * speed - verticalSpeed * verticalSpeed));

            Vector3d progradeVessel = KrpsKrpcMath.DirectionFromWorldSpace(
                vesselFrame,
                KrpsKrpcMath.WorldPrograde(vessel)
            );
            if (worldVelocity.sqrMagnitude <= 1e-4) {
                progradeVessel = new Vector3d(0.0, 0.0, 1.0);
            }

            Vector3d noseWorld = new Vector3d(
                vessel.ReferenceTransform.up.x,
                vessel.ReferenceTransform.up.y,
                vessel.ReferenceTransform.up.z
            );
            Vector3d bottomWorld = new Vector3d(
                vessel.ReferenceTransform.forward.x,
                vessel.ReferenceTransform.forward.y,
                vessel.ReferenceTransform.forward.z
            );
            double headingNoseDeg = HeadingFromSurfaceDirection(surfaceFrame, noseWorld);
            double headingBottomDeg = HeadingFromSurfaceDirection(surfaceFrame, bottomWorld);

            return new KrpsAttitude {
                PitchDeg = phr.x,
                RollDeg = phr.z,
                HeadingDeg = phr.y,
                HeadingBottomDeg = headingBottomDeg,
                HeadingNoseDeg = headingNoseDeg,
                KspHeadingDeg = phr.y,
                SurfaceRotation = ToArray(vesselToSurface),
                Prograde = new[] { progradeVessel.x, progradeVessel.y, progradeVessel.z },
                SurfaceSpeedMs = horizontalSpeed,
                OrbitalSpeedMs = speed
            };
        }

        private static double HeadingFromSurfaceDirection(KrpsQuatD surfaceFrame, Vector3d worldDirection) {
            Vector3d local = KrpsKrpcMath.DirectionFromWorldSpace(surfaceFrame, worldDirection);
            double headingDeg = Math.Atan2(local.z, local.y) * Mathf.Rad2Deg;
            if (headingDeg < 0.0) {
                headingDeg += 360.0;
            }
            return headingDeg;
        }

        private static float[] ToArray(KrpsQuatD q) {
            return new[] { (float)q.x, (float)q.y, (float)q.z, (float)q.w };
        }

        private static string FormatQuat(float[] q) {
            return "(" + q[0].ToString("F3", CultureInfo.InvariantCulture) + "," +
                q[1].ToString("F3", CultureInfo.InvariantCulture) + "," +
                q[2].ToString("F3", CultureInfo.InvariantCulture) + "," +
                q[3].ToString("F3", CultureInfo.InvariantCulture) + ")";
        }

        private static void AppendField(StringBuilder sb, string name, long value, bool first) {
            if (!first) {
                sb.Append(',');
            }
            sb.Append('"').Append(name).Append("\":").Append(value.ToString(CultureInfo.InvariantCulture));
        }

        private static void AppendField(StringBuilder sb, string name, double value, bool first) {
            if (!first) {
                sb.Append(',');
            }
            sb.Append('"').Append(name).Append("\":").Append(value.ToString("R", CultureInfo.InvariantCulture));
        }

        private static void AppendArray(StringBuilder sb, string name, float[] values, bool first) {
            if (!first) {
                sb.Append(',');
            }
            sb.Append('"').Append(name).Append("\":[");
            for (int i = 0; i < values.Length; i++) {
                if (i > 0) {
                    sb.Append(',');
                }
                sb.Append(values[i].ToString("R", CultureInfo.InvariantCulture));
            }
            sb.Append(']');
        }

        private static void AppendArray(StringBuilder sb, string name, double[] values, bool first) {
            if (!first) {
                sb.Append(',');
            }
            sb.Append('"').Append(name).Append("\":[");
            for (int i = 0; i < values.Length; i++) {
                if (i > 0) {
                    sb.Append(',');
                }
                sb.Append(values[i].ToString("R", CultureInfo.InvariantCulture));
            }
            sb.Append(']');
        }

        private static void AppendString(StringBuilder sb, string name, string value, bool first) {
            if (!first) {
                sb.Append(',');
            }
            sb.Append('"').Append(name).Append("\":\"").Append(Escape(value)).Append('"');
        }

        private static string Escape(string value) {
            return (value ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
    }

    internal struct KrpsAttitude {
        public double PitchDeg;
        public double RollDeg;
        public double HeadingDeg;
        public double HeadingBottomDeg;
        public double HeadingNoseDeg;
        public double KspHeadingDeg;
        public float[] SurfaceRotation;
        public double[] Prograde;
        public double SurfaceSpeedMs;
        public double OrbitalSpeedMs;
    }
}
