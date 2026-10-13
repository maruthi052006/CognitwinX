uniform float uTime;
uniform float uWaterHeight;
uniform float uWaveIntensity;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
    vUv = uv;
    
    // Wave ripple displacement dynamics
    float wave1 = sin(position.x * 0.18 + uTime * 2.0) * 0.06 * uWaveIntensity;
    float wave2 = cos(position.y * 0.15 + uTime * 1.6) * 0.05 * uWaveIntensity;
    float wave3 = sin((position.x + position.y) * 0.25 + uTime * 2.4) * 0.03 * uWaveIntensity;
    
    vec3 displaced = position;
    displaced.z += (wave1 + wave2 + wave3) + uWaterHeight;

    vNormal = normalize(normalMatrix * vec3(wave1 * 2.0, wave2 * 2.0, 1.0));
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
