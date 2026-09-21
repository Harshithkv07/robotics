import asyncio
import websockets
import logging
from api.websocket_server import SimulationServer

logging.basicConfig(level=logging.INFO)

async def main():
    server = SimulationServer()
    
    # Start WebSocket server
    ws_server = await websockets.serve(server.handler, "0.0.0.0", 8765)
    logging.info("WebSocket telemetry server started on ws://0.0.0.0:8765")
    
    # Run simulation loop
    await server.simulation_loop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Server stopped.")
