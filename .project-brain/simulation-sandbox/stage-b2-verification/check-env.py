import sys

print('Python version:', sys.version)

packages = ['sentence_transformers', 'torch', 'transformers', 'numpy']
for pkg in packages:
    try:
        m = __import__(pkg)
        print(f'{pkg}: {getattr(m, "__version__", "installed")}, path: {getattr(m, "__file__", "unknown")}')
    except ImportError:
        print(f'{pkg}: NOT INSTALLED')

