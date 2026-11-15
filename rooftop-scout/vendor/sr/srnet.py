"""Real-ESRGAN realesr-general-x4v3 (SRVGGNetCompact: 64 features, 32 convolutions, x4, PReLU), without PyTorch.

load(path) reads the PyTorch zip checkpoint with a small unpickler (tensors rebuilt as numpy arrays);
forward(params, img) runs the network in numpy (the reference the browser version is checked against);
export(params, out_bin, out_json) writes the weights for TensorFlow.js: float16, convolution kernels as
[kh, kw, in, out], the last layer's channels reordered so tf.depthToSpace matches torch's PixelShuffle.
"""
import io, json, pickle, sys, zipfile
import numpy as np


class _Storage:
    def __init__(self, zf, prefix, key, dtype):
        self.zf, self.prefix, self.key, self.dtype = zf, prefix, key, dtype

    def array(self):
        return np.frombuffer(self.zf.read(f'{self.prefix}/data/{self.key}'), dtype=self.dtype)


def _rebuild(storage, offset, size, stride, *rest):
    a = storage.array()
    if not size:
        return a[offset:offset + 1].reshape(())
    item = a.itemsize
    return np.lib.stride_tricks.as_strided(a[offset:], shape=tuple(size), strides=tuple(s * item for s in stride)).copy()


DTYPES = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'DoubleStorage': np.float64, 'LongStorage': np.int64, 'IntStorage': np.int32}


def load(path):
    zf = zipfile.ZipFile(path); pkl = [n for n in zf.namelist() if n.endswith('data.pkl')][0]; prefix = pkl.rsplit('/', 1)[0]

    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if mod == 'torch._utils' and name == '_rebuild_tensor_v2':
                return _rebuild
            if mod == 'torch' and name in DTYPES:
                return name
            if mod == 'collections' and name == 'OrderedDict':
                import collections
                return collections.OrderedDict
            return super().find_class(mod, name)

        def persistent_load(self, pid):
            _, stype, key, _loc, _n = pid
            return _Storage(zf, prefix, key, DTYPES[stype if isinstance(stype, str) else stype])

    obj = U(io.BytesIO(zf.read(pkl))).load()
    return obj.get('params', obj.get('params_ema', obj))


def conv3(x, w, b):
    """x [H, W, Cin] float32, w [Cout, Cin, 3, 3], b [Cout] -> [H, W, Cout], zero padding 1"""
    H, W, C = x.shape; xp = np.pad(x, ((1, 1), (1, 1), (0, 0)))
    cols = np.stack([xp[i:i + H, j:j + W, :] for i in range(3) for j in range(3)], axis=2)   # H, W, 9, Cin
    k = w.transpose(2, 3, 1, 0).reshape(9, C, -1)                                              # 9, Cin, Cout
    return np.tensordot(cols, k, axes=([2, 3], [0, 1])) + b


def forward(P, img):
    """img [H, W, 3] in 0..1 -> [4H, 4W, 3]"""
    x = img.astype(np.float32); n = 0; out = x
    keys = sorted({int(k.split('.')[1]) for k in P}, key=int)
    for i in keys:
        w = P[f'body.{i}.weight']
        if w.ndim == 4:
            out = conv3(out, w.astype(np.float32), P[f'body.{i}.bias'].astype(np.float32))
        else:
            a = w.astype(np.float32); out = np.where(out >= 0, out, out * a)
    H, W, C = out.shape; r = 4; c = C // (r * r)
    out = out.reshape(H, W, c, r, r).transpose(0, 3, 1, 4, 2).reshape(H * r, W * r, c)   # torch PixelShuffle: channel c*r*r + i*r + j
    base = np.repeat(np.repeat(x, r, axis=0), r, axis=1)
    return np.clip(out + base, 0, 1)


def export(P, out_bin, out_json):
    keys = sorted({int(k.split('.')[1]) for k in P}, key=int); last = max(i for i in keys if P[f'body.{i}.weight'].ndim == 4)
    layers, blobs, off = [], [], 0
    for i in keys:
        w = P[f'body.{i}.weight'].astype(np.float32)
        if w.ndim == 4:
            b = P[f'body.{i}.bias'].astype(np.float32)
            if i == last:   # reorder outputs c*16 + i*4 + j -> (i*4 + j)*3 + c for tf.depthToSpace
                r = 4; c = w.shape[0] // (r * r); order = [ci * r * r + q for q in range(r * r) for ci in range(c)]
                w, b = w[order], b[order]
            k = w.transpose(2, 3, 1, 0)   # kh, kw, in, out
            for arr, kind in [(k, 'kernel'), (b, 'bias')]:
                h = arr.astype(np.float16).tobytes(); blobs.append(h); layers.append({'layer': i, 'kind': kind, 'shape': list(arr.shape), 'offset': off, 'bytes': len(h)}); off += len(h)
        else:
            h = w.astype(np.float16).tobytes(); blobs.append(h); layers.append({'layer': i, 'kind': 'prelu', 'shape': list(w.shape), 'offset': off, 'bytes': len(h)}); off += len(h)
    open(out_bin, 'wb').write(b''.join(blobs)); json.dump({'model': 'realesr-general-x4v3', 'scale': 4, 'layers': layers}, open(out_json, 'w'))
    return off


if __name__ == '__main__':
    P = load(sys.argv[1])
    print(len(P), 'tensors;', sum(v.size for v in P.values()), 'parameters')
    for k in list(P)[:4] + list(P)[-3:]:
        print(' ', k, P[k].shape, P[k].dtype)
