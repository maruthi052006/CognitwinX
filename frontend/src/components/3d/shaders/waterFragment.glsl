uniform vec3 uWaterColor;
uniform vec3 uGlowColor;
uniform float uOpacity;
uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
    // Fresnel effect for realistic surface glance reflections
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = dot(viewDirection, vNormal);
    fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
    fresnel = pow(fresnel, 2.5);

    // Subtle caustic / dynamic shimmering
    float caustic = sin(vWorldPosition.x * 0.4 + uTime * 1.5) * cos(vWorldPosition.y * 0.4 + uTime * 1.2);
    caustic = clamp(caustic * 0.15, -0.1, 0.2);

    // Base glowing cyan/blue water
    vec3 color = mix(uWaterColor, uGlowColor, fresnel * 0.75 + caustic);
    
    // Glowing specular highlights along crests
    float edgeGlow = smoothstep(0.4, 0.95, fresnel);
    color += uGlowColor * edgeGlow * 0.6;

    gl_FragColor = vec4(color, clamp(uOpacity + fresnel * 0.35, 0.2, 0.85));
}
