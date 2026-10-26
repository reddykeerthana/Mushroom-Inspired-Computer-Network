
"use strict";

const connections = [
    { from: "A", to: "B", cost: 4, active: true },
    { from: "B", to: "C", cost: 4, active: true },
    { from: "A", to: "D", cost: 2, active: true },
    { from: "D", to: "C", cost: 3, active: true }
];

const originalConnections = connections.map(link => ({ ...link }));
const nodeNames = ["A", "B", "C", "D"];

const positions = {
    A: { x: 125, y: 80 },
    B: { x: 475, y: 80 },
    C: { x: 475, y: 270 },
    D: { x: 125, y: 270 }
};

let animationFrame = null;
let animationToken = 0;
let lastRoute = null;

function getElement(id) {
    return document.getElementById(id);
}

function getConnectionId(from, to) {
    return [from, to].sort().join("");
}

// Dijkstra's shortest-path algorithm
function findShortestRoute(start, destination) {
    const distance = {};
    const previous = {};
    const unvisited = new Set(nodeNames);

    nodeNames.forEach(node => {
        distance[node] = Infinity;
        previous[node] = null;
    });

    distance[start] = 0;

    while (unvisited.size > 0) {
        let current = null;

        for (const node of unvisited) {
            if (
                current === null ||
                distance[node] < distance[current]
            ) {
                current = node;
            }
        }

        if (current === null || distance[current] === Infinity) {
            break;
        }

        if (current === destination) {
            break;
        }

        unvisited.delete(current);

        connections
            .filter(link =>
                link.active &&
                (link.from === current || link.to === current)
            )
            .forEach(link => {
                const neighbour =
                    link.from === current ? link.to : link.from;

                if (!unvisited.has(neighbour)) {
                    return;
                }

                const candidate = distance[current] + link.cost;

                if (candidate < distance[neighbour]) {
                    distance[neighbour] = candidate;
                    previous[neighbour] = current;
                }
            });
    }

    if (distance[destination] === Infinity) {
        return null;
    }

    const path = [];
    let current = destination;

    while (current !== null) {
        path.unshift(current);
        current = previous[current];
    }

    return {
        path,
        cost: distance[destination]
    };
}

function stopPacketAnimation() {
    animationToken++;

    if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
}

function hidePacket() {
    const packet = getElement("dataPacket");

    if (packet) {
        packet.setAttribute("visibility", "hidden");
    }
}

function updateDashboard() {
    const activeCount = connections.filter(link => link.active).length;
    const total = connections.length;
    const percentage = Math.round((activeCount / total) * 100);

    getElement("linkCount").innerHTML =
        `${activeCount} <small>/ ${total}</small>`;

    getElement("connectionNote").textContent =
        activeCount === total
            ? "All links available"
            : `${total - activeCount} link(s) unavailable`;

    getElement("healthBar").style.width = `${percentage}%`;

    getElement("healthBar").style.background =
        percentage === 100 ? "#5a9a68" :
        percentage >= 50 ? "#d5a146" : "#d85e59";

    getElement("routeStatus").textContent =
        percentage === 100 ? "Optimal" :
        percentage >= 50 ? "Degraded" : "Critical";

    getElement("statusDetail").textContent =
        `${percentage}% connection availability`;
}

function clearRouteStyles() {
    connections.forEach(link => {
        const line = getElement(getConnectionId(link.from, link.to));

        if (!line) {
            console.warn(
                "SVG connection not found:",
                getConnectionId(link.from, link.to)
            );
            return;
        }

        line.classList.remove("route-link");
        line.classList.toggle("failed-link", !link.active);
    });

    document.querySelectorAll(".network-node").forEach(node => {
        node.classList.remove("selected-node");
    });
}

function highlightRoute(path) {
    clearRouteStyles();

    for (let i = 0; i < path.length - 1; i++) {
        const line = getElement(
            getConnectionId(path[i], path[i + 1])
        );

        if (line) {
            line.classList.add("route-link");
            line.classList.remove("failed-link");
        }
    }

    path.forEach(node => {
        const element = getElement("node" + node);

        if (element) {
            element.classList.add("selected-node");
        }
    });
}

function movePacket(path) {
    const packet = getElement("dataPacket");

    if (!packet || !path.length) {
        return;
    }

    stopPacketAnimation();

    const thisAnimation = animationToken;
    const points = path.map(node => positions[node]);

    packet.setAttribute("cx", points[0].x);
    packet.setAttribute("cy", points[0].y);
    packet.setAttribute("visibility", "visible");

    if (points.length === 1) {
        return;
    }

    const duration = (points.length - 1) * 900;
    const startTime = performance.now();

    function animate(now) {
        if (thisAnimation !== animationToken) {
            return;
        }

        const progress = Math.min((now - startTime) / duration, 1);
        const segmentCount = points.length - 1;
        const position = progress * segmentCount;
        const segment = Math.min(
            Math.floor(position),
            segmentCount - 1
        );
        const fraction = progress >= 1 ? 1 : position - segment;

        const from = points[segment];
        const to = points[segment + 1];

        packet.setAttribute(
            "cx",
            from.x + (to.x - from.x) * fraction
        );

        packet.setAttribute(
            "cy",
            from.y + (to.y - from.y) * fraction
        );

        if (progress < 1) {
            animationFrame = requestAnimationFrame(animate);
        } else {
            animationFrame = null;
        }
    }

    animationFrame = requestAnimationFrame(animate);
}

function showResult(title, message, isError = false) {
    const box = getElement("result");
    box.classList.toggle("error", isError);
    box.replaceChildren();

    const symbol = document.createElement("span");
    symbol.className = "result-symbol";
    symbol.textContent = isError ? "!" : "✳";

    const content = document.createElement("div");
    const heading = document.createElement("strong");
    const paragraph = document.createElement("p");

    heading.textContent = title;
    paragraph.textContent = message;

    content.append(heading, paragraph);
    box.append(symbol, content);
}

function addHistory(action, details, cost = "--") {
    const body = getElement("historyBody");

    if (!body) {
        return;
    }

    if (body.querySelector(".empty-history")) {
        body.replaceChildren();
    }

    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    const actionCell = document.createElement("td");
    const detailsCell = document.createElement("td");
    const costCell = document.createElement("td");

    const badge = document.createElement("span");
    badge.className = "event-pill";

    if (action.toLowerCase().includes("failure")) {
        badge.classList.add("failure");
    } else if (action.toLowerCase().includes("reset")) {
        badge.classList.add("reset");
    }

    badge.textContent = action;
    timeCell.textContent = new Date().toLocaleTimeString();
    actionCell.appendChild(badge);
    detailsCell.textContent = details;
    costCell.textContent = cost;
    costCell.className = "cost-cell";

    row.append(timeCell, actionCell, detailsCell, costCell);
    body.prepend(row);

    while (body.rows.length > 10) {
        body.deleteRow(body.rows.length - 1);
    }
}

function clearHistory() {
    const body = getElement("historyBody");
    body.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 4;
    cell.className = "empty-history";
    cell.textContent = "History cleared. Find a route to begin.";

    row.appendChild(cell);
    body.appendChild(row);
}

function showRoute() {
    const start = getElement("start").value;
    const destination = getElement("destination").value;

    stopPacketAnimation();
    hidePacket();
    clearRouteStyles();

    const routeCost = getElement("routeCost");
    routeCost.textContent = "--";

    if (start === destination) {
        lastRoute = { path: [start], cost: 0 };

        highlightRoute(lastRoute.path);
        movePacket(lastRoute.path);

        routeCost.textContent = "0";

        showResult(
            "Already at destination",
            `Computer ${start} is both the source and destination. Cost: 0.`
        );

        addHistory("Route found", `${start} → ${destination}`, 0);
        return;
    }

    const route = findShortestRoute(start, destination);

    if (!route) {
        lastRoute = null;

        showResult(
            "No available route",
            `No working path connects ${start} to ${destination}. Restore a link or choose another destination.`,
            true
        );

        addHistory("Route unavailable", `${start} → ${destination}`);
        return;
    }

    lastRoute = route;
    highlightRoute(route.path);
    movePacket(route.path);

    const pathText = route.path.join(" → ");
    routeCost.textContent = route.cost;

    showResult(
        "Best route selected",
        `${pathText} · Total connection cost: ${route.cost}.`
    );

    addHistory("Route found", pathText, route.cost);
}

function simulateFailure() {
    const link = connections.find(
        item => getConnectionId(item.from, item.to) === "AD"
    );

    if (!link) {
        showResult("Connection not found", "The A-D link is missing.", true);
        return;
    }

    if (!link.active) {
        showResult(
            "Link already unavailable",
            "The A-D connection has already failed. Reset the network to restore it."
        );
        return;
    }

    stopPacketAnimation();
    hidePacket();

    link.active = false;
    updateDashboard();
    clearRouteStyles();

    addHistory("Link failure", "Connection A-D is unavailable");

    showResult(
        "Connection failure detected",
        "Link A-D is unavailable. Searching for an alternative route..."
    );

    showRoute();
}

function resetNetwork() {
    stopPacketAnimation();
    hidePacket();

    connections.forEach((link, index) => {
        link.active = originalConnections[index].active;
    });

    lastRoute = null;

    updateDashboard();
    clearRouteStyles();
    getElement("routeCost").textContent = "--";

    showResult(
        "Network restored",
        "All four connections are available. You can find a new route."
    );

    addHistory("Network reset", "All connections restored");
}

document.addEventListener("DOMContentLoaded", () => {
    getElement("findRouteBtn").addEventListener("click", showRoute);
    getElement("failureBtn").addEventListener("click", simulateFailure);
    getElement("resetBtn").addEventListener("click", resetNetwork);
    getElement("clearHistoryBtn").addEventListener("click", clearHistory);

    updateDashboard();
    clearRouteStyles();
});
