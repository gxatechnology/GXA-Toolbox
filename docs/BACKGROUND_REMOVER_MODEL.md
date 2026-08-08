# Background Remover Model Decision

## Selected model

U2NetP (`u2netp-web.onnx`), Apache-2.0, 4,574,267 bytes, RGB NCHW input at 320×320. The checked-in graph removes incompatible MaxPool `ceil_mode` attributes while retaining the original model separately in the legacy asset set.

## Evaluation

| Model | License | Browser fit | Quality profile | Decision |
|---|---|---|---|---|
| U2NetP | Apache-2.0 | Excellent: current 4.57 MB ONNX graph already verified in ORT WebGPU/WASM | Good general salient-subject masks; soft hair/product edges can need manual refinement | Selected for predictable load, memory, and mobile feasibility |
| U2Net | Apache-2.0 | Technically feasible but substantially larger and more memory intensive | Usually stronger detail than U2NetP | Not selected without a validated browser graph and fixture evidence justifying the download/memory cost |
| MODNet | Apache-2.0 | ONNX is possible; model specializes in portraits | Strong portrait/hair matting, weaker fit for products, animals, and arbitrary foreground classes | Not suitable as the only general Background Remover model |
| DIS / IS-Net | Apache-2.0 | High-quality but materially heavier; released general model requires a separately validated conversion | Strong high-resolution dichotomous segmentation; upstream notes dataset/category limitations for some releases | Deferred until a browser-sized licensed graph is benchmarked on all fixtures |

Primary upstream references: https://github.com/xuebinqin/U-2-Net, https://github.com/ZHKKKe/MODNet, and https://github.com/xuebinqin/DIS.

## Matting decision

No second matting model was added. A model without a validated browser graph, deterministic local distribution, and measured cross-category gain would add memory/download cost without proving quality. The current pipeline preserves soft probability alpha, includes worker-based smoothing/feather/expand/contract/defringe/edge contrast, and provides erase/restore painting. This is real segmentation plus manual edge refinement, not a falsely labeled learned matting stage.

## Known limitations

At 320×320 inference, very fine hair, transparent objects, multiple overlapping subjects, dark-on-dark, and light-on-light edges may need manual work. U2NetP is a salient-object model, not semantic instance segmentation. The app rejects uniform/suspicious masks instead of silently falling back to color-key removal.
