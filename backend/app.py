from flask import Flask, redirect, url_for, session, request, render_template
from msal import ConfidentialClientApplication
import os
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
TENANT_ID = os.getenv("TENANT_ID", "common")
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
REDIRECT_PATH = "/getAToken"
SCOPE = ["User.Read"]

app = Flask(__name__, template_folder="../frontend/templates", static_folder="../frontend/static")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["PERMANENT_SESSION_LIFETIME"] = 3600

msal_app = ConfidentialClientApplication(
    client_id=CLIENT_ID,
    client_credential=CLIENT_SECRET,
    authority=AUTHORITY
)

@app.route("/")
def index():
    if not session.get("user"):
        return render_template("index.html")  # 👈 FIX: render login page
    return f"Welcome {session['user'].get('preferred_username', 'User')}!"

@app.route("/login")
def login():
    session["state"] = os.urandom(16).hex()
    auth_url = msal_app.get_authorization_request_url(
        scopes=SCOPE,
        redirect_uri=request.base_url.replace("login", "getAToken"),
        state=session["state"]
    )
    return redirect(auth_url)

@app.route("/getAToken")
def authorized():
    if request.args.get("state") != session.get("state"):
        return "State verification failed", 400
    if "error" in request.args:
        return f"Authentication failed: {request.args['error_description']}", 401

    code = request.args.get("code")
    if not code:
        return "No auth code provided", 400

    result = msal_app.acquire_token_by_authorization_code(
        code=code,
        scopes=SCOPE,
        redirect_uri="http://localhost:5000/getAToken"  #request.base_url
    )

    if "error" in result:
        return f"Token acquisition failed: {result.get('error_description')}", 401

    session["user"] = result.get("id_token_claims")
    return redirect(url_for("index"))

@app.route("/logout")
def logout():
    session.clear()
    return redirect(
        f"{AUTHORITY}/oauth2/v2.0/logout?"
        f"post_logout_redirect_uri={url_for('index', _external=True)}"
    )

if __name__ == "__main__":
    app.run(debug=True)
