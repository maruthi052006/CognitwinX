import numpy as np
from scipy.ndimage import uniform_filter  # type: ignore[import-untyped]

def apply_lee_filter(img: np.ndarray, size: int = 5) -> np.ndarray:
    """
    Standard Lee Filter for SAR speckle noise reduction.
    Filters multiplicative radar speckle while preserving sharp water-land boundaries.
    """
    img_mean = uniform_filter(img, (size, size))
    img_sqr_mean = uniform_filter(img**2, (size, size))
    img_variance = np.maximum(0.0, img_sqr_mean - img_mean**2)

    overall_variance = np.var(img)
    if overall_variance == 0:
        return img

    # Weighting coefficient
    weights = img_variance / (img_variance + overall_variance + 1e-8)
    return img_mean + weights * (img - img_mean)

def compute_glcm_texture_proxy(img: np.ndarray) -> np.ndarray:
    """
    Computes local contrast and homogeneity texture proxy for radar surfaces.
    Calm flood water surfaces exhibit near-zero local contrast.
    """
    diff_x = np.abs(np.diff(img, axis=1, prepend=img[:, :1]))
    diff_y = np.abs(np.diff(img, axis=0, prepend=img[:1, :]))
    local_contrast = (diff_x + diff_y) / 2.0
    return uniform_filter(local_contrast, size=3)

def preprocess_sensing_data(sar_raw: np.ndarray, optical_ndwi: np.ndarray | None = None, fused_mode: bool = False) -> dict:
    """
    Full perception preprocessing pipeline:
    1. Calibrate sigma0 dB values
    2. Lee speckle suppression
    3. GLCM texture extraction
    4. Optional optical NDWI fusion
    5. Normalization to [0, 1] for Attention U-Net
    """
    # 1. Radiometric calibration (clip outliers)
    sar_clipped = np.clip(sar_raw, -30.0, 0.0)
    if sar_clipped.shape != (128, 128):
        from scipy.ndimage import zoom  # type: ignore[import-untyped]
        zf = (128.0 / sar_clipped.shape[0], 128.0 / sar_clipped.shape[1])
        sar_clipped = zoom(sar_clipped, zf, order=1)
    
    # 2. Speckle filter
    sar_filtered = apply_lee_filter(sar_clipped, size=5)

    # 3. Normalize SAR to [0, 1] (where 1 = strong water signature, i.e., low radar return)
    # SAR water is typically < -18 dB
    sar_norm = np.clip((-sar_filtered - 5.0) / 25.0, 0.0, 1.0)

    # 4. GLCM texture
    texture = compute_glcm_texture_proxy(sar_filtered)
    texture_norm = np.clip(texture / 5.0, 0.0, 1.0)

    # 5. Fusion mode: combine SAR with Sentinel-2 NDWI if available
    if fused_mode and optical_ndwi is not None:
        # NDWI > 0 is water
        ndwi_water_prob = np.clip((optical_ndwi + 0.2) / 1.0, 0.0, 1.0)
        # Weighted fusion: 60% SAR + 40% Optical NDWI
        fused_tensor = 0.60 * sar_norm + 0.40 * ndwi_water_prob
    else:
        fused_tensor = sar_norm

    return {
        'input_patch': fused_tensor.astype(np.float32),
        'sar_filtered': sar_filtered,
        'texture': texture_norm,
        'fused_mode': fused_mode,
        'patch_shape': fused_tensor.shape
    }
