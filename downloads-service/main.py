import os

from flask import Flask, Response
from google.cloud import storage


app = Flask(__name__)
client = storage.Client()
bucket = client.bucket(os.environ.get("APK_BUCKET", "vfixurpc-app-downloads"))
object_name = os.environ.get(
    "APK_OBJECT",
    "releases/VfixurPC-Android-2026-09-16-offers.apk",
)


@app.get("/")
@app.get("/VfixurPC.apk")
def download_apk():
    blob = bucket.blob(object_name)
    blob.reload()

    def stream_apk():
        with blob.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                yield chunk

    return Response(
        stream_apk(),
        mimetype="application/vnd.android.package-archive",
        headers={
            "Content-Disposition": "attachment; filename=VfixurPC.apk",
            "Cache-Control": "public, max-age=300",
            "ETag": blob.etag or "",
            "X-Goog-Hash": f"crc32c={blob.crc32c}" if blob.crc32c else "",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/health")
def health():
    return {"status": "ok"}
