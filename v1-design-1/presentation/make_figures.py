"""Figures and equation images for the presentation.  python presentation/make_figures.py

Every chart is computed from the real model (sim/) or the shipped demo library (viewer/public/data).
Images are rendered at 300 dpi at their final on-slide size, so a 24 pt font in matplotlib is 24 pt on
the slide. assets/manifest.json records each image's natural size in inches for the slide builder.
"""
import json
import os
import sys
from math import atan, cos, degrees, log, radians, sin, tan, acos, pi

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Arc, FancyArrowPatch, Polygon

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ROOT))
from sim.model import VEH, rollout, trailer_pose, footprints, step  # noqa: E402
from sim.planner import hitch_regulator  # noqa: E402

OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)
DPI = 300
INK, TEAL, AMBER, RED, GREEN, GREY, SOFT = "#14212B", "#0E7C86", "#B8741A", "#C0392B", "#1E8449", "#5D6D7E", "#DCEBEC"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 24, "axes.labelsize": 24, "xtick.labelsize": 24,
    "ytick.labelsize": 24, "legend.fontsize": 24, "axes.edgecolor": GREY, "axes.labelcolor": INK,
    "xtick.color": INK, "ytick.color": INK, "text.color": INK, "axes.linewidth": 1.4,
    "mathtext.fontset": "cm", "savefig.facecolor": "white",
})
manifest = {}
L1, L2, D = VEH.L1, VEH.L2, VEH.d


def save(fig, name, w, h):
    fig.set_size_inches(w, h)
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=DPI, facecolor="white")
    plt.close(fig)
    manifest[name] = {"w": w, "h": h}
    print("wrote", name)


# ------------------------------------------------------------------ equations
def eq(name, tex, size=30, color=INK):
    fig = plt.figure(figsize=(0.01, 0.01))
    fig.text(0, 0, f"${tex}$", fontsize=size, color=color)
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=DPI, bbox_inches="tight", pad_inches=0.04, transparent=True)
    plt.close(fig)
    from PIL import Image
    w, h = Image.open(path).size
    manifest[name] = {"w": w / DPI, "h": h / DPI}
    print("wrote", name, f"{w / DPI:.2f}x{h / DPI:.2f} in")


EQS = {
    # state and model
    "eq_state.png": (r"X=\left[\,x_1,\;y_1,\;\theta_0,\;\psi\,\right]^{T}\qquad U=\left[\,v,\;\delta\,\right]^{T}", 32),
    "eq_psi_def.png": (r"\psi=\theta_0-\theta_1", 30),
    "eq_xdot.png": (r"\dot{x}_1=v\cos\theta_0", 32),
    "eq_ydot.png": (r"\dot{y}_1=v\sin\theta_0", 32),
    "eq_thdot.png": (r"\dot{\theta}_0=\frac{v}{L_1}\tan\delta", 32),
    "eq_psidot.png": (r"\dot{\psi}=\frac{v\,\tan\delta}{L_1}\;-\;\frac{v\,\sin\psi}{L_2}\;-\;\frac{v\,d\,\tan\delta\,\cos\psi}{L_1L_2}", 34),
    # instability
    "eq_lin.png": (r"\dot{\psi}\approx-\frac{v}{L_2}\,\psi\qquad\lambda=-\frac{v}{L_2}", 30),
    "eq_exact.png": (r"\frac{d\psi}{ds}=\frac{\sin\psi}{L_2}\;\Rightarrow\;\tan\frac{\psi(s)}{2}=\tan\frac{\psi_0}{2}\,e^{\,s/L_2}", 28),
    # holding / critical steering
    "eq_hold.png": (r"\dot{\psi}=0\;\Rightarrow\;\tan\delta_{hold}=\frac{L_1}{L_2}\;\frac{\sin\psi}{1-\frac{d}{L_2}\cos\psi}", 30),
    "eq_crit.png": (r"\cos\psi^{*}=\frac{d}{L_2}\;\Rightarrow\;\delta_{crit}=26.6^{\circ}", 30),
    # regulator
    "eq_reg.png": (r"\tan\delta=\frac{L_1\left[\,\sin\psi/L_2-\mathrm{sgn}(v)\,k\,(\psi-\psi_{des})\,\right]}{1-\frac{d}{L_2}\cos\psi}", 30),
    "eq_reg_cl.png": (r"\Rightarrow\;\dot{\psi}=-|v|\,k\,(\psi-\psi_{des})", 30),
    "eq_reg_s.png": (r"\psi(s)-\psi_{des}\;\propto\;e^{-k\,s},\quad k=0.5\;\mathrm{m}^{-1}", 30),
    # planner
    "eq_cost.png": (r"g=\sum\left[\,\ell\,c_{gear}+0.25\,|\psi_{des}|\,\ell+0.6\,|\Delta\psi_{des}|+0.6\,\frac{|\psi|}{\psi_{plan}}\,\ell+6\,\mathbf{1}_{switch}\right]", 28),
    "eq_heur.png": (r"h=\varepsilon\left[\max\left(D_{Dubins}^{\,trailer},\;D_{grid}\right)+3\,|\psi|\right],\quad\varepsilon=3", 28),
    "eq_flat.png": (r"\kappa_1=\frac{\tan\psi}{L_2}\quad\Leftrightarrow\quad\psi=\arctan\left(L_2\,\kappa_1\right)", 30),
    # NMPC
    "eq_ocp.png": (r"\min_{u_1,\ldots,u_8}\;J=\sum_{k=1}^{24}\ell\left(X_k,X_k^{ref}\right)+\ell_N\left(X_{24}\right)+R\sum_j u_j^{2}+S\sum_j\left(u_j-u_{j-1}\right)^{2}", 28),
    "eq_stage.png": (r"\ell=0.6\,\Vert p_1-p_1^{ref}\Vert^{2}+1.5\,e_{\theta_1}^{2}+15\,e_{\psi}^{2}+0.15\,\Vert p_0-p_0^{ref}\Vert^{2}+0.3\,e_{\theta_0}^{2}", 28),
    "eq_dyn.png": (r"X_{k+1}=f_{RK4}\!\left(X_k,\;v_k,\;\mathrm{sat}\left(\delta^{ff}_k+u_{\lceil k/3\rceil}\right)\right),\quad X_0=X(t)", 28),
    "eq_cons.png": (r"|\psi_k|\leq 60^{\circ}\quad|u_j|\leq 35^{\circ}\quad c(X_k)\geq 0.25\,\mathrm{m}", 30),
    "eq_word.png": (r"J=\sum\Vert X-X_{ref}\Vert_Q^{2}+\sum\Vert U\Vert_R^{2}+\sum\Vert\Delta U\Vert_S^{2}", 28),
    "eq_term.png": (r"\ell_N=8\,\Vert e_{p_1}\Vert^{2}+60\,e_{\theta_1}^{2}+60\,e_{\psi}^{2}+\Vert e_{p_0}\Vert^{2},\qquad R=0.02,\;\;S=3", 28),
    # guidance
    "eq_turns.png": (r"n_{turns}=\frac{\delta\cdot 20}{360^{\circ}}\qquad(35^{\circ}\;\mathrm{lock}\;\rightarrow\;1.94\;\mathrm{turns})", 30),
    "eq_speed.png": (r"v(s)\leq\min\left\{v_{max}\left(1-0.65\,\frac{\max|\delta|}{\delta_{max}}\right),\;\sqrt{v_{0}^{2}+2as},\;\sqrt{2a(s_{end}-s)}\right\}", 26),
    # problem statement
    "eq_problem.png": (r"\mathrm{find}\;\;U(t)\;\;\mathrm{s.t.}\;\;X(0)=X_{gate},\;\;X(T)\approx X_{bay}", 30),
    # syllabus alignment
    "eq_frames.png": (r"p_h=p_0+d\left[\cos\theta_0,\;\sin\theta_0\right]^{T}\qquad p_1=p_h-L_2\left[\cos\theta_1,\;\sin\theta_1\right]^{T}", 28),
    "eq_nonholo.png": (r"\dot{x}_1\sin\theta_0-\dot{y}_1\cos\theta_0=0\qquad(\mathrm{wheels\;roll,\;never\;slide})", 28),
    "eq_ctrl.png": (r"\dot{\psi}=-|v|\,k\,(\psi-\psi_{des})\qquad\min_{U}\,J\;\;\mathrm{s.t.}\;\;|\psi|\leq 60^{\circ}", 28),
}


# ------------------------------------------------------------------ geometry diagram
def geometry():
    fig, ax = plt.subplots()
    th0, psi, delta = radians(18), radians(34), radians(24)
    s = (0.0, 0.0, th0, psi)
    tractor, trailer = footprints(s)
    ax.add_patch(Polygon(trailer, closed=True, fc="#EDF1F5", ec=GREY, lw=2))
    ax.add_patch(Polygon(tractor, closed=True, fc="#E3F0F1", ec=TEAL, lw=2.4))
    tx, ty, th1 = trailer_pose(s)
    hx, hy = D * cos(th0), D * sin(th0)
    fx, fy = L1 * cos(th0), L1 * sin(th0)
    ax.plot([tx, hx], [ty, hy], color=GREY, lw=2, ls="--")
    ax.plot([0, fx], [0, fy], color=TEAL, lw=2, ls="--")
    # theta0: global x reference at the rear axle
    ax.plot([0, 3.4], [0, 0], color=INK, lw=1.4)
    ax.add_patch(Arc((0, 0), 5.2, 5.2, theta1=0, theta2=degrees(th0), color=INK, lw=2))
    ax.text(3.05 * cos(radians(-9)), 3.05 * sin(radians(-9)), r"$\theta_0$", fontsize=30, va="center")
    # psi: between the backward tractor axis and the trailer axis, drawn behind the hitch
    back = th0 + pi
    ax.plot([hx, hx + 3.6 * cos(back)], [hy, hy + 3.6 * sin(back)], color=TEAL, lw=1.6, ls=":")
    ax.add_patch(Arc((hx, hy), 6.0, 6.0, theta1=degrees(th1 + pi), theta2=degrees(back), color=AMBER, lw=3.5))
    am = (th1 + pi + back) / 2
    ax.text(hx + 3.7 * cos(am), hy + 3.7 * sin(am), r"$\psi$", fontsize=36, color=AMBER, ha="center", va="center")
    # steering angle at the front wheel
    wa = th0 + delta
    wl = 1.3
    ax.plot([fx - wl / 2 * cos(wa), fx + wl / 2 * cos(wa)], [fy - wl / 2 * sin(wa), fy + wl / 2 * sin(wa)],
            color=INK, lw=7, solid_capstyle="round")
    ax.plot([fx, fx + 2.4 * cos(th0)], [fy, fy + 2.4 * sin(th0)], color=TEAL, lw=1.6, ls=":")
    ax.add_patch(Arc((fx, fy), 3.6, 3.6, theta1=degrees(th0), theta2=degrees(wa), color=INK, lw=2))
    ax.text(fx + 2.35 * cos(th0 + delta / 2), fy + 2.35 * sin(th0 + delta / 2), r"$\delta$", fontsize=32, va="center")
    # points
    for (px, py, c) in ((0, 0, TEAL), (tx, ty, GREY), (fx, fy, TEAL)):
        ax.plot(px, py, "o", ms=11, color=c, zorder=5)
    ax.plot(hx, hy, "o", ms=13, mfc="white", mec=AMBER, mew=3, zorder=6)
    # length labels, outside the bodies
    n0 = (-sin(th0), cos(th0))
    ax.text(fx / 2 + 2.35 * n0[0], fy / 2 + 2.35 * n0[1], r"$L_1$", fontsize=32, color=TEAL, ha="center", va="center")
    n1 = (-sin(th1), cos(th1))
    ax.text((tx + hx) / 2 + 1.95 * n1[0], (ty + hy) / 2 + 1.95 * n1[1], r"$L_2$", fontsize=32, color=GREY, ha="center", va="center")
    ax.annotate("rear axle $(x_1,y_1)$", xy=(0, 0), xytext=(-1.2, -3.2), fontsize=24, color=TEAL, ha="right",
                arrowprops=dict(arrowstyle="->", color=TEAL, lw=2))
    ax.annotate("hitch", xy=(hx, hy), xytext=(2.4, -3.2), fontsize=24, color=AMBER, ha="left",
                arrowprops=dict(arrowstyle="->", color=AMBER, lw=2))
    ax.text(tx, ty + 1.9, "trailer axle", fontsize=24, color=GREY, ha="center", va="bottom")
    ax.set_aspect("equal")
    ax.set_xlim(-10.6, 7.6)
    ax.set_ylim(-4.2, 6.0)
    ax.axis("off")
    fig.subplots_adjust(0, 0, 1, 1)
    save(fig, "geometry.png", 6.3, 3.6)


# ------------------------------------------------------------------ open-loop instability
def instability():
    fig, ax = plt.subplots()
    s = np.linspace(0, 40, 800)
    p0 = radians(2)
    rev = np.degrees(2 * np.arctan(np.tan(p0 / 2) * np.exp(s / L2)))
    fwd = np.degrees(2 * np.arctan(np.tan(p0 / 2) * np.exp(-s / L2)))
    ax.axhspan(60, 90, color="#F6DCD8", zorder=0)
    ax.axhline(60, color=RED, lw=2, ls="--")
    ax.plot(s, rev, color=RED, lw=4, label="reverse")
    ax.plot(s, fwd, color=GREEN, lw=4, label="forward")
    ax.plot([28.0], [60], "o", color=RED, ms=12)
    ax.annotate("60° after 28 m", xy=(28.0, 60), xytext=(4.5, 70), fontsize=24, color=RED,
                arrowprops=dict(arrowstyle="->", color=RED, lw=2))
    ax.set_xlim(0, 40)
    ax.set_ylim(0, 90)
    ax.set_yticks([0, 30, 60, 90])
    ax.set_xlabel("distance travelled  s  (m)")
    ax.set_ylabel(r"hitch angle  $\psi$  (°)")
    ax.text(3, 44, "reverse", fontsize=24, color=RED, ha="left", va="center")
    ax.text(39, 8, "forward", fontsize=24, color=GREEN, ha="right", va="center")
    ax.spines[["top", "right"]].set_visible(False)
    fig.subplots_adjust(left=0.18, right=0.93, top=0.96, bottom=0.24)
    save(fig, "instability.png", 5.6, 4.1)


# ------------------------------------------------------------------ steering to hold psi
def holding():
    fig, ax = plt.subplots()
    p = np.radians(np.linspace(0, 150, 600))
    dh = np.degrees(np.arctan((L1 / L2) * np.sin(p) / (1 - (D / L2) * np.cos(p))))
    pc = acos(D / L2)
    dc = degrees(atan((L1 / L2) * sin(pc) / (1 - (D / L2) * cos(pc))))
    ax.axhline(35, color=GREY, lw=2, ls="--")
    ax.text(3, 36.2, "steering lock 35°", fontsize=24, color=GREY, ha="left", va="bottom")
    ax.plot(np.degrees(p), dh, color=TEAL, lw=4)
    h60 = degrees(atan((L1 / L2) * sin(radians(60)) / (1 - (D / L2) * cos(radians(60)))))
    ax.vlines(60, h60, 35, color=AMBER, lw=5)
    ax.plot([60], [h60], "o", color=AMBER, ms=12)
    ax.annotate("at 60°: hold 24°,\n11° left to correct", xy=(60, h60), xytext=(147, 5), fontsize=24, color=AMBER,
                ha="right", va="bottom", arrowprops=dict(arrowstyle="->", color=AMBER, lw=2))
    ax.plot([degrees(pc)], [dc], "o", color=RED, ms=12)
    ax.text(degrees(pc) + 5, dc + 1.2, f"max {dc:.1f}°", fontsize=24, color=RED, ha="left", va="bottom")
    ax.set_xlim(0, 150)
    ax.set_ylim(0, 45)
    ax.set_xticks([0, 30, 60, 90, 120, 150])
    ax.set_yticks([0, 15, 30, 45])
    ax.set_xlabel(r"hitch angle  $\psi$  (°)")
    ax.set_ylabel(r"$\delta_{hold}$  (°)")
    ax.spines[["top", "right"]].set_visible(False)
    fig.subplots_adjust(left=0.17, right=0.92, top=0.95, bottom=0.23)
    save(fig, "holding.png", 5.6, 4.1)


# ------------------------------------------------------------------ regulator closed loop vs open loop
def regulator():
    fig, ax = plt.subplots()
    ds = 0.05
    n = int(30 / ds)
    s_axis = np.arange(n + 1) * ds
    for p0 in (25, -15):
        st = (0.0, 0.0, 0.0, radians(p0))
        out = [p0]
        for _ in range(n):
            st = step(st, -1.0, hitch_regulator(st[3], -1.0, 0.0), ds)
            out.append(degrees(st[3]))
        ax.plot(s_axis, out, color=TEAL, lw=4)
    st = (0.0, 0.0, 0.0, radians(3))
    ol = [3.0]
    for _ in range(n):
        st = step(st, -1.0, 0.0, ds)
        ol.append(degrees(st[3]))
    ax.plot(s_axis, ol, color=RED, lw=4, ls="--")
    ax.text(21.5, 50, "open loop", fontsize=24, color=RED, ha="right")
    ax.text(29.5, -17, "regulated, k = 0.5", fontsize=24, color=TEAL, ha="right", va="center")
    ax.axhline(0, color=GREY, lw=1)
    ax.set_xlim(0, 30)
    ax.set_ylim(-30, 70)
    ax.set_yticks([-30, 0, 30, 60])
    ax.set_xlabel("reversing distance  s  (m)")
    ax.set_ylabel(r"$\psi$  (°)")
    ax.spines[["top", "right"]].set_visible(False)
    fig.subplots_adjust(left=0.24, right=0.93, top=0.95, bottom=0.23)
    save(fig, "regulator.png", 5.6, 4.1)


# ------------------------------------------------------------------ planner motion primitives
def primitives():
    from sim.planner import plan_regulator
    fig, ax = plt.subplots()
    tractor, trailer = footprints((0.0, 0.0, 0.0, 0.0))
    ax.add_patch(Polygon(trailer, closed=True, fc="#EDF1F5", ec=GREY, lw=1.5))
    ax.add_patch(Polygon(tractor, closed=True, fc="#E3F0F1", ec=TEAL, lw=1.5))
    ds = 0.1
    for gear, col in ((1, GREEN), (-1, AMBER)):
        for pd in (-45, -25, 0, 25, 45):
            st = (0.0, 0.0, 0.0, 0.0)
            xs, ys = [0.0], [0.0]
            for _ in range(int(10 / ds)):
                st = step(st, float(gear), plan_regulator(st[3], gear, radians(pd)), ds)
                xs.append(st[0]); ys.append(st[1])
            ax.plot(xs, ys, color=col, lw=3.5)
            ax.plot(xs[-1], ys[-1], "o", color=col, ms=8)
    ax.plot(0, 0, "o", color=INK, ms=9, zorder=5)
    ax.text(10.8, 0, "forward", fontsize=24, color=GREEN, va="center", ha="left")
    ax.text(-10.8, 0, "reverse", fontsize=24, color=AMBER, va="center", ha="right")
    ax.set_aspect("equal")
    ax.set_xlim(-20.5, 20.5)
    ax.set_ylim(-7.0, 7.0)
    ax.axis("off")
    fig.subplots_adjust(0, 0, 1, 1)
    save(fig, "primitives.png", 5.4, 2.1)


# ------------------------------------------------------------------ Dubins path of the trailer axle
def dubins_fig():
    from sim.dubins import dubins_words, sample
    rho = 10.0
    a = (0.0, 0.0, 0.0)
    b = (30.0, 24.0, pi / 2)
    words = dubins_words(*a, *b, rho)
    length, word, par = min(words, key=lambda w: w[0])
    pts = np.array(sample(*a, word, par, rho, step=0.05))
    fig, ax = plt.subplots()
    # segment boundaries by arc length
    seglen = [par[0] * rho, par[1] * rho, par[2] * rho]
    d = np.concatenate([[0], np.cumsum(np.hypot(np.diff(pts[:, 0]), np.diff(pts[:, 1])))])
    cols = [TEAL if c != "S" else GREY for c in word]
    edges = [0, seglen[0], seglen[0] + seglen[1], sum(seglen) + 1]
    for k in range(3):
        m = (d >= edges[k] - 1e-6) & (d <= edges[k + 1] + 0.05)
        ax.plot(pts[m, 0], pts[m, 1], color=cols[k], lw=5, solid_capstyle="round")
    for (x, y, th), lab in ((a, "start"), (b, "goal")):
        ax.add_patch(FancyArrowPatch((x, y), (x + 5 * cos(th), y + 5 * sin(th)), arrowstyle="-|>", mutation_scale=28,
                                     color=INK, lw=3))
    ax.text(0, -3.2, "start", fontsize=24, ha="center", va="top")
    ax.text(b[0] + 2.2, b[1] - 1.5, "goal", fontsize=24, ha="left", va="center")
    ax.text(15, -3.2, f"{word}:  {length:.1f} m", fontsize=24, color=INK, ha="left", va="top")
    ax.text(-4, 22, r"$\rho=10$ m", fontsize=26, color=TEAL, ha="left", va="center")
    ax.set_aspect("equal")
    ax.set_xlim(-6, 40)
    ax.set_ylim(-8, 32)
    ax.axis("off")
    fig.subplots_adjust(0, 0, 1, 1)
    save(fig, "dubins.png", 4.6, 4.0)
    manifest["dubins_info"] = {"word": word, "length": round(length, 2)}


# ------------------------------------------------------------------ guided vs unaided, real run
def compare():
    data = json.load(open(os.path.join(ROOT, "..", "viewer", "public", "data", "cross_0.json")))
    plan = data["plans"]["5"]
    g = np.array(plan["frames"])
    u = np.array(plan["baseline"]["frames"])
    fig, ax = plt.subplots()
    ax.axhspan(60, 90, color="#F6DCD8", zorder=0)
    ax.axhspan(-90, -60, color="#F6DCD8", zorder=0)
    for y in (60, -60):
        ax.axhline(y, color=RED, lw=2, ls="--")
    ax.plot(g[:, 0], np.degrees(g[:, 4]), color=TEAL, lw=3.5, label="NMPC guidance")
    ax.plot(u[:, 0], np.degrees(u[:, 4]), color=RED, lw=3.5, label="unaided driver")
    tj = plan["baseline"]["t_jack"]
    ax.plot([tj], [np.degrees(u[-1, 4])], "X", color=RED, ms=18)
    ax.annotate("jackknife", xy=(tj, np.degrees(u[-1, 4])), xytext=(tj + 9, 76), fontsize=24, color=RED, va="center",
                arrowprops=dict(arrowstyle="->", color=RED, lw=2))
    ax.text(99, -75, "limits ±60°", fontsize=24, color=RED, ha="right", va="center")
    ax.set_xlim(0, 101)
    ax.set_ylim(-90, 90)
    ax.set_yticks([-60, -30, 0, 30, 60])
    ax.set_xlabel("time  (s)")
    ax.set_ylabel(r"hitch angle  $\psi$  (°)")
    ax.legend(loc="lower center", bbox_to_anchor=(0.45, 1.0), ncol=2, frameon=False, handlelength=1.1, columnspacing=1.0, handletextpad=0.4)
    ax.spines[["top", "right"]].set_visible(False)
    fig.subplots_adjust(left=0.19, right=0.96, top=0.86, bottom=0.18)
    save(fig, "compare.png", 7.6, 5.0)
    info = {"guided_peak": float(np.max(np.abs(np.degrees(g[:, 4])))), "unaided_peak": float(np.max(np.abs(np.degrees(u[:, 4])))),
            "t_jack": tj, "duration": plan["duration"]}
    manifest["compare_info"] = info
    print("compare", info)


def nonmin():
    """Reverse with a constant left steer: the tractor turns one way, the trailer the other."""
    s0 = (0.0, 0.0, 0.0, 0.0)
    v, dt, n = -1.0, 0.05, 240          # 12 m of reversing
    dist, th0, th1 = [0.0], [0.0], [0.0]
    s = s0
    for k in range(n):
        s = step(s, v, radians(10), dt)
        dist.append((k + 1) * dt * abs(v))
        th0.append(degrees(s[2]))
        th1.append(degrees(trailer_pose(s)[2]))
    fig, ax = plt.subplots()
    ax.axhline(0, color=GREY, lw=1)
    ax.plot(dist, th0, color=RED, lw=3.5)
    ax.plot(dist, th1, color=TEAL, lw=3.5)
    ax.text(0.6, 24, "trailer $\\theta_1$", color=TEAL, ha="left", va="center", fontsize=24)
    ax.text(0.6, -26, "tractor $\\theta_0$", color=RED, ha="left", va="center", fontsize=24)
    ax.set_ylim(-36, 36)
    ax.set_xlabel("distance reversed  (m)")
    ax.set_ylabel("heading (°)")
    ax.set_xlim(0, 12)
    ax.spines[["top", "right"]].set_visible(False)
    fig.subplots_adjust(left=0.22, right=0.95, top=0.95, bottom=0.23)
    save(fig, "nonmin.png", 5.6, 4.1)
    print("nonmin end: th0 %.1f th1 %.1f" % (th0[-1], th1[-1]))


if __name__ == "__main__":
    for name, (tex, size) in EQS.items():
        eq(name, tex, size)
    geometry()
    instability()
    holding()
    regulator()
    primitives()
    dubins_fig()
    compare()
    nonmin()
    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
    print("done")
