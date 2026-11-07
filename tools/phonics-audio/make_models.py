# Make the two working copies of the Kokoro-82M ONNX model that build.py uses, from the published
# kokoro-v1.0.onnx (kokoro-onnx project's "model-files-v1.0" release; Apache-2.0):
#   models/kokoro-v1.0-timed.onnx  the same model with its per-phoneme durations exposed as an output ("duration")
#   models/kokoro-v1.0-dur.onnx    the same, plus an input "dur_scale" (per-token duration multiplier, 1.0 = unchanged)
import onnx
from onnx import helper, TensorProto
SRC = 'models/kokoro-v1.0.onnx'
T = '/encoder/Gather_output_0'          # integer frames per token, just before the CumSum that builds the alignment
m = onnx.load(SRC); g = m.graph
g.node.append(helper.make_node('Identity', [T], ['duration']))
g.output.append(helper.make_tensor_value_info('duration', TensorProto.INT64, None))
onnx.save(m, 'models/kokoro-v1.0-timed.onnx')
m = onnx.load(SRC); g = m.graph
cons = [n for n in g.node if T in n.input]
g.input.append(helper.make_tensor_value_info('dur_scale', TensorProto.FLOAT, ['sequence_length']))
nodes = [helper.make_node('Cast', [T], ['ds_f'], to=TensorProto.FLOAT), helper.make_node('Mul', ['ds_f', 'dur_scale'], ['ds_m']),
         helper.make_node('Round', ['ds_m'], ['ds_r']),
         helper.make_node('Constant', [], ['ds_one'], value=helper.make_tensor('one', TensorProto.FLOAT, [], [1.0])),
         helper.make_node('Max', ['ds_r', 'ds_one'], ['ds_c']), helper.make_node('Cast', ['ds_c'], ['dur_scaled'], to=TensorProto.INT64)]
for n in cons:
    for i, x in enumerate(n.input):
        if x == T: n.input[i] = 'dur_scaled'
at = next(i for i, n in enumerate(g.node) if T in n.output)
for k, nn in enumerate(nodes): g.node.insert(at + 1 + k, nn)
g.node.append(helper.make_node('Identity', ['dur_scaled'], ['duration']))
g.output.append(helper.make_tensor_value_info('duration', TensorProto.INT64, None))
onnx.save(m, 'models/kokoro-v1.0-dur.onnx')
print('wrote models/kokoro-v1.0-timed.onnx and models/kokoro-v1.0-dur.onnx')
