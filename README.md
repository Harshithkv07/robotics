# Generalized NMPC & 3D Digital Twin Framework

This project is a high-performance, real-time Digital Twin and robust control framework for Multi-Body Mobile Robots. It integrates a highly mathematical **Non-Linear Model Predictive Control (NMPC)** backend with a stunning **React Three Fiber (R3F)** 3D frontend visualization.

## Key Features

- **Mathematical Depth:** Scalable kinematic models extending from a basic 2-DOF Differential Drive up to a highly unstable 5-DOF Multi-Trailer Road Train.
- **Robust NMPC Optimization:** Uses `CasADi` and the `Ipopt` interior point solver to compute optimal receding-horizon trajectories while strictly enforcing hard physical constraints (e.g., jackknife limits).
- **Asynchronous Telemetry:** A robust Python `websockets` server streaming 16-element homogeneous transformation matrices at 50Hz.
- **High-Density React UI:** Real-time metrics, interactive NMPC disturbance injection triggers, radial hitch gauges, and `recharts` rolling telemetry logs.
- **Showstopper Demo Mode:** Automated presentation sequences with global hotkey controls.

## Tech Stack
- **Backend:** Python 3, CasADi, Ipopt, NumPy, Websockets, Asyncio.
- **Frontend:** React 19, Three.js, React Three Fiber (R3F), TailwindCSS v4, Recharts, Lucide Icons.

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js v20+

### 1. Start the Physics & NMPC Backend
No virtual environment is required. Install dependencies globally.
```bash
pip install casadi numpy scipy websockets
cd backend
python server.py
```
*(The server will initialize the models and listen on `ws://localhost:8765`)*

### 2. Start the Digital Twin Frontend
```bash
cd frontend
npm install
npm run dev
```
*(Navigate to `http://localhost:5173` in your browser)*

## Architecture

1. **Solver Loop:** The backend `NMPCSolver` constructs state constraints and objective cost functions dynamically based on the active profile.
2. **Integration:** It simulates physics forward, applies control inputs, and packages the result into global transformation matrices.
3. **Transmission:** State vectors, horizon predictions, and matrices are serialized and broadcast via WebSockets.
4. **Rendering:** The React frontend interpolates states natively in `useFrame`, rendering accurate kinematic joint articulations inside the Three.js canvas.

## Presentation Mode
Refer to `PRESENTATION_GUIDE.md` for detailed instructions on delivering the live 60-second automated academic showcase.

---
*Built as a capstone exploration into autonomous systems, rigid body transformations, and constrained predictive control.*
