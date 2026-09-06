const baseFrame = () => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
export function getPetAnimation(petId) {
    return { frame: (input) => petFrame(petId, input) };
}
function petFrame(petId, input) {
    const phase = input.phase ?? 0;
    const wave = Math.sin(input.time + phase);
    const frame = baseFrame();
    if (petId === "rabbit-yuzu")
        return yuzuFrame(frame, input, phase, wave);
    if (petId === "capybara-gamja")
        return gamjaFrame(frame, input, phase);
    if (petId === "quokka-bangul")
        return bangulFrame(frame, input, phase);
    return defaultFrame(frame, input, phase, wave);
}
function yuzuFrame(frame, input, phase, wave) {
    if (input.status === "working") {
        frame.x = Math.round(Math.sin(input.time * 5 + phase) * 2);
        frame.y = -Math.round(Math.abs(Math.sin(input.time * 2.5 + phase)) * 4);
    }
    else if (input.status === "done") {
        frame.y = -Math.round(Math.abs(wave) * 8);
        frame.rotation = Math.sin(input.time * 2 + phase) * 0.07;
    }
    else if (input.status === "needs_review" || input.status === "needs_input") {
        frame.x = Math.round(Math.sin(input.time * 2.6 + phase) * 4);
    }
    else if (input.status === "blocked" || input.status === "failed") {
        frame.x = Math.round(Math.sin(input.time * 7 + phase) * 2);
        frame.rotation = -0.04;
    }
    else
        frame.y = -Math.round(Math.abs(Math.sin(input.time * 0.8 + phase)) * 3);
    return frame;
}
function gamjaFrame(frame, input, phase) {
    frame.scaleY = 1 + Math.sin(input.time * 0.35 + phase) * 0.015;
    if (input.status === "working")
        frame.y = Math.round(Math.sin(input.time * 1.2 + phase));
    else if (input.status === "done") {
        frame.y = -Math.round(Math.abs(Math.sin(input.time * 1.1 + phase)) * 2);
        frame.rotation = Math.sin(input.time * 1.4 + phase) * 0.045;
    }
    else if (input.status === "needs_review" || input.status === "needs_input")
        frame.y = -Math.round(Math.abs(Math.sin(input.time * 1.4 + phase)) * 2);
    else if (input.status === "blocked" || input.status === "failed") {
        const shake = Math.sin(input.time * 7 + phase);
        frame.x = Math.round(shake * 2);
        frame.y = 2 + Math.round(Math.abs(shake));
        frame.scaleY = 0.94;
        frame.rotation = -0.035 + shake * 0.018;
    }
    return frame;
}
function bangulFrame(frame, input, phase) {
    frame.rotation = Math.sin(input.time * 0.9 + phase) * 0.025;
    if (input.status === "working")
        frame.y = -Math.round(Math.abs(Math.sin(input.time * 2 + phase)) * 3);
    else if (input.status === "done") {
        frame.y = -Math.round(Math.abs(Math.sin(input.time * 1.7 + phase)) * 7);
        frame.rotation = Math.sin(input.time * 3 + phase) * 0.08;
    }
    else if (input.status === "needs_review" || input.status === "needs_input")
        frame.x = Math.round(Math.sin(input.time * 2 + phase) * 3);
    else if (input.status === "blocked" || input.status === "failed") {
        frame.x = Math.round(Math.sin(input.time * 6 + phase) * 2);
        frame.rotation = -0.05;
    }
    return frame;
}
function defaultFrame(frame, input, phase, wave) {
    if (input.status === "working") {
        frame.x = Math.round(Math.sin(input.time * 3 + phase));
        frame.y = Math.round(wave * 1.4);
    }
    else if (input.status === "done") {
        frame.y = -Math.round(Math.abs(wave) * 5);
        frame.rotation = Math.sin(input.time * 1.8 + phase) * 0.02;
    }
    else if (input.status === "blocked" || input.status === "failed") {
        frame.y = 3 + Math.round(wave * 0.5);
        frame.rotation = -0.025;
    }
    else if (input.status === "needs_review" || input.status === "needs_input")
        frame.y = -Math.round(Math.abs(wave) * 3);
    else if (input.status === "idle") {
        frame.x = Math.round(Math.sin(input.time * 0.24 + phase) * 7);
        frame.y = -Math.round(Math.abs(wave) * 1.5);
    }
    else
        frame.y = Math.round(wave);
    return frame;
}
