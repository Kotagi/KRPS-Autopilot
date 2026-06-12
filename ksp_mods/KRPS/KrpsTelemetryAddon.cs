using System;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using UnityEngine;

[assembly: KSPAssembly("KRPS", 1, 0, 0)]

namespace KRPS {
    [KSPAddon(KSPAddon.Startup.Flight, false)]
    public sealed class KrpsTelemetryAddon : MonoBehaviour {
        private const int Port = 50002;
        private const string Host = "127.0.0.1";

        private TcpListener _listener;
        private TcpClient _client;
        private NetworkStream _stream;
        private readonly StringBuilder _lineBuffer = new StringBuilder();
        private long _seq;

        private void Start() {
            try {
                _listener = new TcpListener(IPAddress.Parse(Host), Port);
                _listener.Start();
                Debug.Log("[KRPS] Telemetry server listening on " + Host + ":" + Port);
            } catch (Exception ex) {
                Debug.LogError("[KRPS] Failed to start telemetry server: " + ex.Message);
            }
        }

        private void OnDestroy() {
            CloseClient();
            if (_listener != null) {
                _listener.Stop();
                _listener = null;
            }
        }

        private void FixedUpdate() {
            AcceptClientIfNeeded();
            if (_stream == null || !FlightGlobals.ActiveVessel) {
                return;
            }

            try {
                string json = KrpsVesselSampler.BuildTelemetryJson(FlightGlobals.ActiveVessel, ++_seq);
                byte[] payload = Encoding.UTF8.GetBytes(json + "\n");
                _stream.Write(payload, 0, payload.Length);
            } catch (Exception ex) {
                Debug.LogWarning("[KRPS] Telemetry send failed: " + ex.Message);
                CloseClient();
            }
        }

        private void AcceptClientIfNeeded() {
            if (_listener == null) {
                return;
            }

            if (_client != null && _client.Connected && _stream != null) {
                return;
            }

            CloseClient();

            if (!_listener.Pending()) {
                return;
            }

            try {
                _client = _listener.AcceptTcpClient();
                _client.NoDelay = true;
                _stream = _client.GetStream();
                Debug.Log("[KRPS] Autopilot connected to telemetry stream");
            } catch (Exception ex) {
                Debug.LogWarning("[KRPS] Accept failed: " + ex.Message);
                CloseClient();
            }
        }

        private void CloseClient() {
            try {
                if (_stream != null) {
                    _stream.Close();
                }
            } catch {
            }

            try {
                if (_client != null) {
                    _client.Close();
                }
            } catch {
            }

            _stream = null;
            _client = null;
            _lineBuffer.Length = 0;
        }
    }
}
