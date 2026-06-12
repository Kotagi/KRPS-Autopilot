using System;
using UnityEngine;

namespace KRPS {
    /// <summary>
    /// Geometry and reference-frame helpers ported from kRPC SpaceCenter
    /// (GeometryExtensions.cs and ReferenceFrame.cs).
    /// </summary>
    internal struct KrpsQuatD {
        public double x;
        public double y;
        public double z;
        public double w;

        public KrpsQuatD(double x, double y, double z, double w) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
        }

        public static KrpsQuatD Inverse(KrpsQuatD q) {
            return new KrpsQuatD(-q.x, -q.y, -q.z, q.w);
        }

        public static KrpsQuatD Multiply(KrpsQuatD a, KrpsQuatD b) {
            return new KrpsQuatD(
                a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
                a.w * b.y + a.y * b.w + a.z * b.x - a.x * b.z,
                a.w * b.z + a.z * b.w + a.x * b.y - a.y * b.x,
                a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
            );
        }

        public static KrpsQuatD FromUnity(Quaternion q) {
            return new KrpsQuatD(q.x, q.y, q.z, q.w);
        }

        public Quaternion ToUnity() {
            return new Quaternion((float)x, (float)y, (float)z, (float)w);
        }

        public Vector3d Rotate(Vector3d v) {
            var qv = new KrpsQuatD(v.x, v.y, v.z, 0.0);
            var result = Multiply(Multiply(this, qv), Inverse(this));
            return new Vector3d(result.x, result.y, result.z);
        }
    }

    internal static class KrpsKrpcMath {
        public static Vector3d ToNorthPole(Vessel vessel) {
            CelestialBody body = vessel.mainBody;
            return body.position + ((Vector3d)body.transform.up) * body.Radius - vessel.CoM;
        }

        public static KrpsQuatD SurfaceFrameRotation(Vessel vessel) {
            Vector3d radial = vessel.CoM - vessel.mainBody.position;
            Vector3d northPole = ToNorthPole(vessel).normalized;
            Vector3d up = Vector3d.Exclude(radial, northPole);
            Vector3d forward = Vector3d.Cross(radial, northPole);
            OrthoNormalize2(ref forward, ref up);
            return LookRotation2(forward, up);
        }

        public static KrpsQuatD VesselFrameRotation(Vessel vessel) {
            Vector3d up = new Vector3d(
                vessel.ReferenceTransform.up.x,
                vessel.ReferenceTransform.up.y,
                vessel.ReferenceTransform.up.z
            );
            Vector3d forward = new Vector3d(
                vessel.ReferenceTransform.forward.x,
                vessel.ReferenceTransform.forward.y,
                vessel.ReferenceTransform.forward.z
            );
            OrthoNormalize2(ref forward, ref up);
            return LookRotation2(forward, up);
        }

        public static KrpsQuatD RotationFromWorldSpace(KrpsQuatD frameRotation, Quaternion worldRotation) {
            return KrpsQuatD.Multiply(KrpsQuatD.Inverse(frameRotation), KrpsQuatD.FromUnity(worldRotation));
        }

        public static Vector3d DirectionFromWorldSpace(KrpsQuatD frameRotation, Vector3d worldDirection) {
            return KrpsQuatD.Inverse(frameRotation).Rotate(worldDirection);
        }

        public static Vector3d VelocityFromWorldSpace(
            KrpsQuatD frameRotation,
            Vector3d frameVelocity,
            Vector3d worldVelocity
        ) {
            return KrpsQuatD.Inverse(frameRotation).Rotate(worldVelocity - frameVelocity);
        }

        public static Vector3d PitchHeadingRoll(KrpsQuatD q) {
            Vector3d eulerAngles = EulerAnglesYzx(q);
            double pitch = eulerAngles.y > 180.0 ? 360.0 - eulerAngles.y : -eulerAngles.y;
            double heading = eulerAngles.z;
            double roll = eulerAngles.x >= 90.0 ? 270.0 - eulerAngles.x : -90.0 - eulerAngles.x;
            return new Vector3d(pitch, heading, roll);
        }

        public static Vector3d WorldVelocity(Vessel vessel) {
            return vessel.GetOrbit().GetVel();
        }

        public static Vector3d WorldPrograde(Vessel vessel) {
            return WorldVelocity(vessel).normalized;
        }

        private static Vector3d EulerAnglesYzx(KrpsQuatD q) {
            var angles = new Quaternion((float)q.z, (float)q.x, (float)q.y, (float)q.w).eulerAngles;
            var result = new Vector3d(angles.z, angles.x, angles.y);
            result.x = ClampAngle360(result.x);
            result.y = ClampAngle360(result.y);
            result.z = ClampAngle360(result.z);
            return result;
        }

        private static double ClampAngle360(double angle) {
            angle = angle % 360.0;
            if (angle < 0.0) {
                angle += 360.0;
            }
            return angle;
        }

        private static void OrthoNormalize2(ref Vector3d normal, ref Vector3d tangent) {
            normal = normal.normalized;
            tangent = tangent.normalized;
            tangent = tangent - normal * Vector3d.Dot(tangent, normal);
            tangent = tangent.normalized;
        }

        private static KrpsQuatD LookRotation2(Vector3d forward, Vector3d up) {
            OrthoNormalize2(ref forward, ref up);
            Vector3d right = Vector3d.Cross(up, forward);
            double w = Math.Sqrt(1.0 + right.x + up.y + forward.z) * 0.5;
            double r = 0.25 / w;
            double x = (up.z - forward.y) * r;
            double y = (forward.x - right.z) * r;
            double z = (right.y - up.x) * r;
            return new KrpsQuatD(x, y, z, w);
        }
    }
}
