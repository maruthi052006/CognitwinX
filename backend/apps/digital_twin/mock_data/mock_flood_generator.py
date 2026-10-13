"""Generates realistic-looking mock flood prediction/simulation data so the
3D water layer, confidence gauges, and Cognition Feed have something
meaningful to render without any real ML inference running yet."""
import random
import numpy as np

class MockFloodSimulator:
    def __init__(self, grid_size=64, seed=None):
        self.grid_size = grid_size
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)

    def generate_heightmap(self, rainfall_mm, low_lying_bias=True):
        """Produces a smooth, realistic-looking depth heightmap grid (not
        random noise) using layered Perlin-like smoothing so the water
        visually pools in a believable way."""
        base = np.random.rand(self.grid_size, self.grid_size)
        # smooth it (simple box blur, repeated, acts like cheap Perlin noise)
        for _ in range(4):
            base = self._box_blur(base)
        if low_lying_bias:
            # bias water toward one side/corner to simulate a drainage low-point
            gradient = np.linspace(0, 1, self.grid_size).reshape(-1, 1)
            base = base * 0.6 + (1 - gradient) * 0.4
        intensity = min(1.0, max(0.05, rainfall_mm / 150.0))
        depth_m = base * intensity * 1.5  # max ~1.5m at full intensity
        return depth_m.tolist()

    def _box_blur(self, grid):
        padded = np.pad(grid, 1, mode="edge")
        out = np.zeros_like(grid)
        for i in range(grid.shape[0]):
            for j in range(grid.shape[1]):
                out[i, j] = padded[i:i+3, j:j+3].mean()
        return out

    def generate_prediction(self, zone_id, rainfall_mm, is_fused=False):
        confidence = round(random.uniform(0.78, 0.96) if is_fused else random.uniform(0.65, 0.91), 2)
        heightmap = self.generate_heightmap(rainfall_mm)
        max_depth = float(np.max(heightmap))
        return {
            "zone_id": zone_id,
            "predicted_depth_m": round(max_depth, 2),
            "confidence_score": confidence,
            "depth_heightmap_grid": heightmap,
            "rainfall_mm": rainfall_mm,
            "is_fused_prediction": is_fused,
        }
