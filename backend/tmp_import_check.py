import sys, os, importlib, traceback
print('cwd', os.getcwd())
print('sys.path[0]', sys.path[0])
try:
    m = importlib.import_module('utils.linkedin_hr')
    print('import ok, file:', getattr(m, '__file__', None))
except Exception as e:
    print('import failed:', type(e).__name__, e)
    traceback.print_exc()
    raise
