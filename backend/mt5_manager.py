"""
backend/mt5_manager.py
Minimal stub — the actual MT5 data flow is handled exclusively
by the push model (mt5_bridge/app.py on Windows pushes data to
/api/mt5/push and /api/mt5/push-prices). This file is kept as
a no-op facade for backward compatibility.
"""


class MT5BridgeManager:
    """No-op manager. Connection state is tracked via MT5Account DB rows."""

    async def shutdown_all(self):
        """Called on app shutdown — nothing to clean up in push model."""
        pass


mt5_manager = MT5BridgeManager()
