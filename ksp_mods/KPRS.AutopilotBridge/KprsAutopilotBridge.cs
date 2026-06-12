using System;
using System.Reflection;
using KRPC.Service;
using KRPC.Service.Attributes;
using MuMech;
using UnityEngine;

namespace KPRS.AutopilotBridge {
    /// <summary>
    /// kRPC bridge for MechJeb 2.14+ ascent targets stored in MechJebModuleAscentSettings.
    /// kRPC.MechJeb 0.7.0 still reads legacy ascent modules, which can be out of sync with the UI.
    /// </summary>
    [KRPCService(Name = "KprsAutopilot")]
    public static class KprsAutopilotService {
        private static readonly MethodInfo GetComputerModule = typeof(MechJebCore).GetMethod(
            "GetComputerModule",
            BindingFlags.Public | BindingFlags.Instance,
            null,
            new[] { typeof(string) },
            null
        );

        private static object GetSettings() {
            Vessel vessel = FlightGlobals.ActiveVessel;
            if (vessel == null) {
                return null;
            }

            MechJebCore core = vessel.GetMasterMechJeb();
            if (core == null || GetComputerModule == null) {
                return null;
            }

            return GetComputerModule.Invoke(core, new object[] { "MechJebModuleAscentSettings" });
        }

        private static double GetEditableMeters(object editable) {
            if (editable == null) {
                return 0.0;
            }

            PropertyInfo val = editable.GetType().GetProperty(
                "val",
                BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase
            );
            if (val == null) {
                return 0.0;
            }

            return Convert.ToDouble(val.GetValue(editable, null));
        }

        private static void SetEditableMeters(object editable, double meters) {
            if (editable == null) {
                return;
            }

            PropertyInfo val = editable.GetType().GetProperty(
                "val",
                BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase
            );
            if (val == null) {
                return;
            }

            val.SetValue(editable, meters, null);
        }

        private static object GetFieldValue(object instance, string fieldName) {
            FieldInfo field = instance.GetType().GetField(
                fieldName,
                BindingFlags.Public | BindingFlags.Instance
            );
            if (field == null) {
                return null;
            }

            return field.GetValue(instance);
        }

        private static void SetFieldValue(object instance, string fieldName, object value) {
            FieldInfo field = instance.GetType().GetField(
                fieldName,
                BindingFlags.Public | BindingFlags.Instance
            );
            if (field == null) {
                return;
            }

            field.SetValue(instance, value);
        }

        [KRPCProperty]
        public static bool Available {
            get { return GetSettings() != null; }
        }

        /// <summary>MechJeb 2.14 ascent type: 0 = Classic, 1 = PSG (PVG/RSS/RO).</summary>
        [KRPCProperty]
        public static int AscentType {
            get {
                object settings = GetSettings();
                if (settings == null) {
                    return 0;
                }

                object raw = GetFieldValue(settings, "AscentTypeInteger");
                return raw == null ? 0 : Convert.ToInt32(raw);
            }
            set {
                object settings = GetSettings();
                if (settings == null) {
                    throw new InvalidOperationException("MechJeb ascent settings are not available");
                }

                SetFieldValue(settings, "AscentTypeInteger", value);
            }
        }

        [KRPCProperty]
        public static double TargetPeriapsisKm {
            get {
                object settings = GetSettings();
                if (settings == null) {
                    throw new InvalidOperationException("MechJeb ascent settings are not available");
                }

                object desiredOrbitAltitude = GetFieldValue(settings, "DesiredOrbitAltitude");
                return GetEditableMeters(desiredOrbitAltitude) / 1000.0;
            }
            set {
                object settings = GetSettings();
                if (settings == null) {
                    throw new InvalidOperationException("MechJeb ascent settings are not available");
                }

                object desiredOrbitAltitude = GetFieldValue(settings, "DesiredOrbitAltitude");
                SetEditableMeters(desiredOrbitAltitude, value * 1000.0);
            }
        }

        [KRPCProperty]
        public static double TargetApoapsisKm {
            get {
                object settings = GetSettings();
                if (settings == null) {
                    throw new InvalidOperationException("MechJeb ascent settings are not available");
                }

                object desiredOrbitAltitude = GetFieldValue(settings, "DesiredOrbitAltitude");
                object desiredApoapsis = GetFieldValue(settings, "DesiredApoapsis");
                double periKm = GetEditableMeters(desiredOrbitAltitude) / 1000.0;
                double apoRawM = GetEditableMeters(desiredApoapsis);
                if (apoRawM <= 0.0) {
                    return periKm;
                }

                double apoKm = apoRawM / 1000.0;
                if (apoKm < periKm) {
                    return periKm;
                }

                if (Math.Abs(apoKm - periKm) < 0.05) {
                    return periKm;
                }

                return apoKm;
            }
            set {
                object settings = GetSettings();
                if (settings == null) {
                    throw new InvalidOperationException("MechJeb ascent settings are not available");
                }

                object desiredOrbitAltitude = GetFieldValue(settings, "DesiredOrbitAltitude");
                object desiredApoapsis = GetFieldValue(settings, "DesiredApoapsis");
                double periM = GetEditableMeters(desiredOrbitAltitude);
                double apoM = value * 1000.0;
                if (value <= 0.0 || apoM <= periM) {
                    SetEditableMeters(desiredApoapsis, 0.0);
                } else {
                    SetEditableMeters(desiredApoapsis, apoM);
                }
            }
        }
    }
}
