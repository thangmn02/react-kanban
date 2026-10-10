import modal

app = modal.App("kora-smoke-test")


@app.function()
def hello():
    import platform

    return {
        "message": "Kora Modal is working",
        "python": platform.python_version(),
        "machine": platform.machine(),
    }


@app.local_entrypoint()
def main():
    result = hello.remote()
    print(result)