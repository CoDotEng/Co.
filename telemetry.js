document.addEventListener("DOMContentLoaded", () => {
    // 1. Inject the Socket.io engine into the page dynamically
    const script = document.createElement('script');
    script.src = "https://cdn.socket.io/4.7.5/socket.io.min.js";
    document.head.appendChild(script);

    // 2. Wait for the engine to load, then boot the telemetry
    script.onload = () => {
        // Build the floating brutalist HUD
        const hud = document.createElement('div');
        hud.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; background: rgba(5,5,5,0.85); border: 1px solid var(--border-color, #222); padding: 12px 15px; font-family: 'Space Grotesk', monospace; font-size: 0.75rem; color: #fff; z-index: 9999; backdrop-filter: blur(8px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 6px; pointer-events: none;">
                <div style="margin-bottom: 4px; font-weight: 700; letter-spacing: 1px; color: var(--text-muted, #888);">CODOT_SYS_UPLINK</div>
                <div style="display: flex; justify-content: space-between; gap: 15px;">
                    <span>STATUS:</span>
                    <span id="tel-status" style="color: #00e5ff; font-weight: 700;">CONNECTING...</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 15px;">
                    <span>CORE LOAD:</span>
                    <span id="tel-load">--</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 15px;">
                    <span>UPTIME:</span>
                    <span id="tel-uptime">--</span>
                </div>
            </div>
        `;
        document.body.appendChild(hud);

        // 3. Open the radio frequency to your Node server
        const socket = io();
        
        // Handle connection state
        socket.on('connect', () => {
            document.getElementById('tel-status').innerText = "LIVE";
            document.getElementById('tel-status').style.color = "#10b981"; // Success green
        });

        // 4. Catch the live data packets and update the HUD instantly
        socket.on('live_status', (data) => {
            document.getElementById('tel-load').innerText = data.serverLoad;
            document.getElementById('tel-uptime').innerText = data.uptime;
            
            // Add a tiny flash effect to show data is moving
            const loadEl = document.getElementById('tel-load');
            loadEl.style.color = "#00e5ff";
            setTimeout(() => loadEl.style.color = "#fff", 150);
        });
        
        // Handle server crashes or disconnects
        socket.on('disconnect', () => {
            document.getElementById('tel-status').innerText = "OFFLINE";
            document.getElementById('tel-status').style.color = "#ef4444"; // Error red
            document.getElementById('tel-load').innerText = "ERR";
            document.getElementById('tel-uptime').innerText = "ERR";
        });
    };
});
