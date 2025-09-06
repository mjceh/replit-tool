# fb_proxy_binary.py
from flask import Flask, request, Response, jsonify, stream_with_context, send_file, send_from_directory, session
import requests
import logging
import time
import json
import base64
import re
import threading
from functools import wraps
import argparse
import sys
import urllib3

# Disable SSL warnings (for development only)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Parse command line arguments
parser = argparse.ArgumentParser(description='Facebook Group Auto Post Proxy')
parser.add_argument('--proxy',
                    type=str,
                    help='Proxy server to use (e.g., localhost:8080)')
parser.add_argument('--insecure',
                    action='store_true',
                    help='Disable SSL verification (for Burp proxy)')
args = parser.parse_args()

# Configure proxy and SSL verification
REQUESTS_PROXIES = None
REQUESTS_VERIFY = True

if args.proxy:
    print(f"Using proxy: {args.proxy}")
    REQUESTS_PROXIES = {
        'http': f'http://{args.proxy}',
        'https': f'http://{args.proxy}'
    }

    # If --insecure flag is used, disable SSL verification
    if args.insecure:
        print("SSL verification disabled (for Burp proxy)")
        REQUESTS_VERIFY = False

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'

# --- DEFAULT CONFIGURATION (fallback if user not logged in) ---
DEFAULT_FB_DTSG = "NAfuf1C09XaVOYiGJ1E8vo3e-XY4TQYqjrt-K7vOqjB6NRVbHvyMqdA:46:1756908348"
DEFAULT_COOKIE_HEADER = "dbln=%7B%22100003109138802%22%3A%22tInGdwXU%22%7D; datr=maTwZo32ZXI6MDe4BM6Aqa7Z; sb=maTwZrCNL1EkI0of-5GExYVe; ps_l=1; ps_n=1; wd=960x958; locale=ar_AR; c_user=100003109138802; xs=46%3A-x7vOlyzLUKRvg%3A2%3A1756908348%3A-1%3A-1; fr=06s5MbiG2eT0CCdrN.AWd4TBbNL4QRvsZsTRdHo1fNkh5JPvH-MIY_PenqGo1WmdKKDuk.BofSe7..AAA.0.0.BouEs_.AWe38Or3gYyvUujG4SYRF1fghuE"
DEFAULT_AV_VALUE = "100003109138802"

# Helper functions for getting user credentials
def get_user_fb_dtsg():
    return session.get('fb_dtsg', DEFAULT_FB_DTSG)

def get_user_cookie_header():
    return session.get('cookie_header', DEFAULT_COOKIE_HEADER)

def get_user_av_value():
    return session.get('av_value', DEFAULT_AV_VALUE)

def get_user_name():
    return session.get('user_name', 'Demo User')
GRAPHQL_URL = "https://www.facebook.com/api/graphql/?fewfeed_urlencoded"
UPLOAD_URL = "https://upload.facebook.com/ajax/react_composer/attachments/photo/upload?__a=1"
# --- END CONFIGURATION ---

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# RESTORED HEADERS - CRITICAL FOR FACEBOOK (base headers without cookie)
BASE_HEADERS = {
    'Host': 'www.facebook.com',
    'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://www.facebook.com  ',
    'Referer': 'https://www.facebook.com/  ',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Ch-Ua':
    '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Linux"',
    'Priority': 'u=1, i'
}

def get_headers():
    """Get headers with current user's cookie"""
    headers = BASE_HEADERS.copy()
    headers['Cookie'] = get_user_cookie_header()
    return headers

# Thread-safe storage for progress
progress_store = {}
progress_lock = threading.Lock()

# Storage for individual post results and control states
individual_post_results = {}
individual_post_lock = threading.Lock()

# Global posting control states
posting_control_states = {}
control_lock = threading.Lock()


def require_json(f):
    """Decorator to ensure request contains JSON data"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == 'POST' and request.content_type != 'application/json':
            return jsonify({"error": "Request must be JSON"}), 400
        return f(*args, **kwargs)

    return decorated_function


@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers',
                         'Content-Type,Authorization,X-Request-ID')
    response.headers.add('Access-Control-Allow-Methods',
                         'GET,PUT,POST,DELETE,OPTIONS')
    # Disable caching for HTML files to ensure updates are visible
    if response.content_type == 'text/html; charset=utf-8':
        response.headers.add('Cache-Control', 'no-cache, no-store, must-revalidate')
        response.headers.add('Pragma', 'no-cache')
        response.headers.add('Expires', '0')
    return response


# Routes for serving the web application
@app.route('/')
def index():
    """Serve the main index.html file"""
    return send_file('index.html')


@app.route('/index.html')
def index_html():
    """Serve index.html directly"""
    return send_file('index.html')


@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (CSS, JS, etc.)"""
    return send_from_directory('.', filename)


@app.route('/fetch_groups', methods=['OPTIONS'])
def handle_options():
    return Response(status=200)


@app.route('/fetch_groups', methods=['GET', 'POST'])
def fetch_groups():
    try:
        logger.info("Received request to /fetch_groups")

        payload = (
            f"fb_dtsg={get_user_fb_dtsg()}&av={get_user_av_value()}"
            "&__dyn=2D_qZPljzChGR8qV8RaJR_nWehb_L96SR_fk4kwWHkSnWjrl10PqoO4YFNURoo4bQF_6Z48zvu34WP3F5S6qAToBcTo_qKamx_bpYvyaaN9YBe9104ToQnFryUFuNTceTPVCdG74Q5NaaHtGYwuWW6ndHRArYaNn9zO4RUd5WC_xwtiohuT-QU3yYk7ttd_sZycXUJkVPd8_Agz5fvYrxkH15nAew-Yy5rSP9ZmjPN4"
            "&variables=%7B%22adminGroupsCount%22%3A90%2C%22memberGroupsCount%22%3A5000%2C%22scale%22%3A1.5%2C%22count%22%3A10%2C%22cursor%22%3Anull%7D"
            "&doc_id=3884641628300421")

        logger.info(f"Making POST request to {GRAPHQL_URL}")
        response = requests.post(GRAPHQL_URL,
                                 headers=get_headers(),
                                 data=payload.encode('utf-8'),
                                 proxies=REQUESTS_PROXIES,
                                 verify=REQUESTS_VERIFY)

        logger.info(f"Facebook response status code: {response.status_code}")
        if response.content:
            snippet = response.content[:2000]
            logger.info(
                f"Facebook response snippet (first 2000 bytes): {snippet}")
        else:
            logger.warning("Facebook response is empty")

        return Response(response.content, mimetype='text/plain; charset=utf-8')

    except requests.exceptions.RequestException as e:
        logger.error(f"Error making request to Facebook: {e}")
        error_details = str(e)
        if hasattr(e, 'response') and e.response is not None:
            error_snippet = e.response.text[:500] if e.response.text else "[No Error Body]"
            error_details += f" | Error Response Snippet: {error_snippet}"
        return Response(
            f"Proxy Error: Failed to fetch data from Facebook. Details: {error_details}",
            status=502,
            mimetype='text/plain')
    except Exception as e:
        logger.error(f"Unexpected error in proxy: {e}", exc_info=True)
        return Response(f"Proxy Error: Internal server error. Details: {e}",
                        status=500,
                        mimetype='text/plain')


@app.route('/post_to_groups', methods=['OPTIONS'])
def post_to_groups_options():
    return Response(status=200)


@app.route('/post_to_groups', methods=['POST'])
@require_json
def post_to_groups():
    """Endpoint to post content to multiple Facebook groups"""
    try:
        request_id = request.headers.get('X-Request-ID', str(int(time.time())))
        data = request.get_json()
        content = data.get('content', '')
        groups = data.get('groups', [])
        delay = int(data.get('delay', 3))
        photo_data = data.get('photo', None)

        if not content:
            return jsonify({"error": "Post content is required"}), 400
        if not groups:
            return jsonify({"error": "At least one group is required"}), 400

        logger.info(
            f"[{request_id}] Starting to post to {len(groups)} groups with delay {delay}s"
        )

        with progress_lock:
            progress_store[request_id] = {
                "status": "processing",
                "total": len(groups),
                "processed": 0,
                "successful": 0,
                "failed": 0
            }

        photo_data_for_posting = photo_data

        def post_task():
            try:
                successful = 0
                for i, group_id in enumerate(groups):
                    # Check if stop was requested
                    with control_lock:
                        control_state = posting_control_states.get(request_id, {})
                        if control_state.get('stop', False):
                            logger.info(f"[{request_id}] Stopping posting as requested")
                            break
                    
                    logger.info(
                        f"[{request_id}] Posting to group {group_id} ({i+1}/{len(groups)})"
                    )

                    post_key = f"{request_id}_{group_id}"
                    with individual_post_lock:
                        individual_post_results[post_key] = {
                            "status": "processing",
                            "message": "Starting post creation...",
                            "group_id": group_id,
                            "timestamp": time.time()
                        }

                    # Check if skip current was requested
                    with control_lock:
                        control_state = posting_control_states.get(request_id, {})
                        if control_state.get('skip_current', False):
                            logger.info(f"[{request_id}] Skipping group {group_id} as requested")
                            with individual_post_lock:
                                individual_post_results[post_key] = {
                                    "status": "skipped",
                                    "message": "Skipped by user",
                                    "group_id": group_id,
                                    "timestamp": time.time()
                                }
                            # Reset skip flag
                            posting_control_states[request_id]['skip_current'] = False
                            continue

                    photo_id = None
                    if photo_data_for_posting:
                        logger.info(
                            f"[{request_id}] Uploading photo for group {group_id}..."
                        )
                        with individual_post_lock:
                            individual_post_results[post_key] = {
                                "status": "processing",
                                "message": "Uploading photo...",
                                "group_id": group_id,
                                "timestamp": time.time()
                            }

                        photo_id = upload_photo(photo_data_for_posting,
                                                f"{request_id}_{group_id}")
                        if not photo_id:
                            logger.error(
                                f"[{request_id}] Failed to upload photo for group {group_id}"
                            )
                            with individual_post_lock:
                                individual_post_results[post_key] = {
                                    "status": "error",
                                    "message": "Photo upload failed",
                                    "group_id": group_id,
                                    "timestamp": time.time()
                                }
                            continue

                    with individual_post_lock:
                        individual_post_results[post_key] = {
                            "status": "processing",
                            "message": "Creating post...",
                            "group_id": group_id,
                            "timestamp": time.time()
                        }

                    success, post_url = create_post(
                        group_id, content, photo_id,
                        f"{request_id}_{group_id}")

                    if success:
                        successful += 1
                        with individual_post_lock:
                            individual_post_results[post_key] = {
                                "status": "success",
                                "message": "Post created successfully",
                                "group_id": group_id,
                                "post_url": post_url,
                                "timestamp": time.time()
                            }
                        logger.info(
                            f"[{request_id}] Successfully posted to group {group_id}"
                        )
                    else:
                        with individual_post_lock:
                            individual_post_results[post_key] = {
                                "status": "error",
                                "message": "Failed to create post",
                                "group_id": group_id,
                                "timestamp": time.time()
                            }
                        logger.error(
                            f"[{request_id}] Failed to post to group {group_id}"
                        )

                    with progress_lock:
                        progress_store[request_id] = {
                            "status": "processing",
                            "processed": i + 1,
                            "total": len(groups),
                            "successful": successful,
                            "failed": (i + 1) - successful,
                            "percentage": int((i + 1) / len(groups) * 100)
                        }

                    if i < len(groups) - 1:
                        time.sleep(delay)

                with progress_lock:
                    progress_store[request_id] = {
                        "status": "completed",
                        "total": len(groups),
                        "successful": successful,
                        "failed": len(groups) - successful
                    }

                # Keep results for 1 hour before cleaning up
                time.sleep(3600)
                with individual_post_lock:
                    for key in list(individual_post_results.keys()):
                        if key.startswith(request_id + '_'):
                            del individual_post_results[key]

            except Exception as e:
                logger.error(f"[{request_id}] Error in posting task: {str(e)}",
                             exc_info=True)
                with progress_lock:
                    progress_store[request_id] = {
                        "status": "error",
                        "message": str(e)
                    }

        threading.Thread(target=post_task).start()

        return jsonify({
            "status": "processing",
            "request_id": request_id,
            "message": "Posting started in background"
        })

    except Exception as e:
        logger.error(f"Error in post_to_groups: {str(e)}", exc_info=True)
        return jsonify({"error": f"Failed to start posting: {str(e)}"}), 500


@app.route('/post_progress', methods=['GET'])
def post_progress():
    """Endpoint for streaming progress updates"""
    request_id = request.args.get('id')

    if not request_id:
        return jsonify({"error": "Request ID is required"}), 400

    def generate():
        try:
            last_percentage = -1
            last_activity = time.time()

            while True:
                current_time = time.time()

                if current_time - last_activity > 15:
                    yield ':keep-alive\n\n'
                    last_activity = current_time

                with progress_lock:
                    if request_id not in progress_store:
                        yield f"data: {json.dumps({'status': 'error', 'message': 'Request ID not found'})}\n\n"
                        break

                    progress = progress_store[request_id]

                    if progress.get('percentage', 0) != last_percentage:
                        last_percentage = progress.get('percentage', 0)
                        yield f"data: {json.dumps(progress)}\n\n"
                        last_activity = current_time

                    if progress['status'] in ['completed', 'error']:
                        break

                time.sleep(0.5)

        except GeneratorExit:
            logger.info(f"Client disconnected for request {request_id}")
        except Exception as e:
            logger.error(f"Error in progress stream: {str(e)}", exc_info=True)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream_with_context(generate()),
                    mimetype='text/event-stream')


@app.route('/post_results/<request_id>', methods=['GET'])
def get_post_results(request_id):
    """Get all individual post results for a request"""
    results = {}
    with individual_post_lock:
        for key, value in individual_post_results.items():
            if key.startswith(request_id + '_'):
                # Extract group_id by removing the request_id prefix
                group_id = key[len(request_id) + 1:]  # +1 for the underscore
                results[group_id] = value

    return jsonify(results)


@app.route('/stop_posting/<request_id>', methods=['POST'])
def stop_posting(request_id):
    """Stop all posting for a request"""
    with control_lock:
        posting_control_states[request_id] = {
            'stop': True,
            'skip_current': False
        }
    logger.info(f"[{request_id}] Stop posting requested")
    return jsonify({"status": "stop_requested"})


@app.route('/skip_current/<request_id>', methods=['POST'])
def skip_current(request_id):
    """Skip current group posting for a request"""
    with control_lock:
        if request_id not in posting_control_states:
            posting_control_states[request_id] = {'stop': False, 'skip_current': False}
        posting_control_states[request_id]['skip_current'] = True
    logger.info(f"[{request_id}] Skip current group requested")
    return jsonify({"status": "skip_requested"})


@app.route('/facebook_auth', methods=['GET'])
def facebook_auth():
    """Provide Facebook login URL for authentication"""
    # This will be loaded in the iframe
    facebook_login_url = "https://www.facebook.com/login.php?next=https%3A%2F%2Fwww.facebook.com%2F"
    return f"""
    <html>
    <head>
        <script>
        // Monitor for successful Facebook login
        function checkForFacebookLogin() {{
            try {{
                // Check if we're on Facebook and logged in
                if (window.location.hostname === 'www.facebook.com' && document.cookie.includes('c_user=')) {{
                    // Extract authentication data
                    const cookies = document.cookie;
                    const dtsgMatch = document.documentElement.innerHTML.match(/"dtsg":{{"token":"([^"]+)"/);
                    const userIdMatch = cookies.match(/c_user=([^;]+)/);
                    const userNameElement = document.querySelector('[data-testid="blue_bar_profile_link"] span, [aria-label*="profile"], .headerTinymanName');
                    
                    if (dtsgMatch && userIdMatch) {{
                        const authData = {{
                            fb_dtsg: dtsgMatch[1],
                            cookie_header: cookies,
                            av_value: userIdMatch[1],
                            user_name: userNameElement ? userNameElement.textContent.trim() : 'Facebook User'
                        }};
                        
                        // Send auth data to parent window
                        window.parent.postMessage({{
                            type: 'facebook_auth_success',
                            data: authData
                        }}, '*');
                    }}
                }}
            }} catch (e) {{
                console.error('Error checking Facebook login:', e);
            }}
        }}
        
        // Check periodically and on page changes
        setInterval(checkForFacebookLogin, 2000);
        window.addEventListener('load', checkForFacebookLogin);
        
        // Redirect to Facebook login
        if (window.location.href !== '{facebook_login_url}') {{
            window.location.href = '{facebook_login_url}';
        }}
        </script>
    </head>
    <body>
        <p style="text-align: center; padding: 20px; font-family: Arial, sans-serif;">
            Redirecting to Facebook login...
        </p>
    </body>
    </html>
    """


@app.route('/save_auth', methods=['POST'])
def save_auth():
    """Save Facebook authentication data to session"""
    try:
        data = request.get_json()
        
        if not data or not all(key in data for key in ['fb_dtsg', 'cookie_header', 'av_value']):
            return jsonify({"error": "Missing authentication data"}), 400
            
        # Save to session
        session['fb_dtsg'] = data['fb_dtsg']
        session['cookie_header'] = data['cookie_header']
        session['av_value'] = data['av_value']
        session['user_name'] = data.get('user_name', 'Facebook User')
        session['authenticated'] = True
        
        logger.info(f"Successfully saved authentication for user: {session['user_name']}")
        return jsonify({
            "status": "success",
            "user_name": session['user_name']
        })
        
    except Exception as e:
        logger.error(f"Error saving authentication: {str(e)}")
        return jsonify({"error": "Failed to save authentication"}), 500


@app.route('/auth_status', methods=['GET'])
def auth_status():
    """Get current authentication status"""
    is_authenticated = session.get('authenticated', False)
    return jsonify({
        "authenticated": is_authenticated,
        "user_name": session.get('user_name', '') if is_authenticated else ''
    })


@app.route('/connect_facebook', methods=['POST'])
def connect_facebook():
    """Connect user with manual Facebook credentials"""
    try:
        data = request.get_json()
        
        if not data or not all(key in data for key in ['cookies', 'dtsg_token', 'user_id']):
            return jsonify({
                'success': False,
                'message': 'Missing required credentials'
            }), 400
        
        # Store credentials in session
        session['cookie_header'] = data['cookies']
        session['dtsg_token'] = data['dtsg_token']
        session['user_id'] = data['user_id']
        session['user_name'] = 'Facebook User'  # We could try to extract real name from cookies if needed
        session['authenticated'] = True
        
        logger.info("User connected with manual credentials")
        
        return jsonify({
            'success': True,
            'user_name': session['user_name'],
            'message': 'Successfully connected to Facebook'
        })
        
    except Exception as e:
        logger.error(f"Error connecting to Facebook: {e}")
        return jsonify({
            'success': False,
            'message': f'Connection failed: {str(e)}'
        }), 500


@app.route('/logout', methods=['POST'])
def logout():
    """Logout user and clear session"""
    session.clear()
    return jsonify({"status": "logged_out"})


def extract_post_url(response_text):
    """Extract post URL from Facebook response"""
    try:
        clean_text = response_text.replace("for (;;);", "")
        response_data = json.loads(clean_text)

        if 'data' in response_data and 'story_create' in response_data['data']:
            story_create = response_data['data']['story_create']

            if story_create and 'story' in story_create:
                story = story_create['story']

                # Extract group ID
                group_id = None
                if 'to' in story and 'id' in story['to']:
                    group_id = story['to']['id']

                # Extract post ID - use legacy_story_hideable_id for proper Facebook URLs
                post_id = None
                if 'legacy_story_hideable_id' in story:
                    post_id = story['legacy_story_hideable_id']
                elif 'id' in story:
                    # Fallback to id field, but try to extract numeric part
                    raw_id = story['id']
                    if 'Uzpf' in raw_id and ':' in raw_id:
                        # The format is: UzpfSTEwMDAwMzEwOTEzODgwMjpWSzoxMjM0NDE2MjcyMDE2NDc4
                        # We need the part after the last colon
                        post_id = raw_id.split(':')[-1]
                    else:
                        post_id = raw_id

                if group_id and post_id:
                    post_url = f"https://www.facebook.com/groups/{group_id}/posts/{post_id}/"
                    logger.info(f"Extracted post URL: {post_url}")
                    return post_url

        logger.warning("Could not find post URL in response structure")
        return None

    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.error(f"Error extracting post URL: {str(e)}")
        return None


def upload_photo(photo_data, request_id=None):
    """Upload a photo to Facebook and return the photo ID"""
    try:
        logger.info(f"[{request_id}] Starting photo upload process")

        if not photo_data:
            logger.error(f"[{request_id}] No photo data provided")
            return None

        content_type = "image/jpeg"
        file_ext = "jpg"
        b64_data = photo_data

        if ';base64,' in photo_data:
            parts = photo_data.split(';base64,')
            content_type = parts[0].split(':')[1] if len(
                parts) > 0 else "image/jpeg"
            b64_data = parts[1] if len(parts) > 1 else photo_data

            if '/' in content_type:
                file_ext = content_type.split('/')[1]
            else:
                file_ext = "jpg"

        logger.info(
            f"[{request_id}] Photo format: {content_type}, extension: {file_ext}"
        )

        try:
            photo_bytes = base64.b64decode(b64_data)
            logger.info(
                f"[{request_id}] Decoded photo, size: {len(photo_bytes)} bytes"
            )
        except Exception as e:
            logger.error(f"[{request_id}] Base64 decode failed: {str(e)}")
            return None

        boundary = "----WebKitFormBoundary" + "".join(
            [chr(i) for i in range(97, 123)]).replace(" ", "")[:16]
        logger.info(f"[{request_id}] Using boundary: {boundary}")

        payload = []

        payload.append(f"--{boundary}\r\n".encode('latin-1'))
        payload.append(
            b"Content-Disposition: form-data; name=\"fb_dtsg\"\r\n\r\n")
        payload.append(f"{get_user_fb_dtsg()}\r\n".encode('latin-1'))

        payload.append(f"--{boundary}\r\n".encode('latin-1'))
        payload.append(
            b"Content-Disposition: form-data; name=\"source\"\r\n\r\n")
        payload.append(b"8\r\n")

        payload.append(f"--{boundary}\r\n".encode('latin-1'))
        payload.append(
            f'Content-Disposition: form-data; name="farr"; filename="photo.{file_ext}"\r\n'
            .encode('latin-1'))
        payload.append(
            f"Content-Type: {content_type}\r\n\r\n".encode('latin-1'))
        payload.append(photo_bytes)
        payload.append(b"\r\n")

        payload.append(f"--{boundary}--\r\n".encode('latin-1'))

        body = b"".join(payload)

        upload_headers = get_headers()
        upload_headers['Host'] = 'upload.facebook.com'
        upload_headers[
            'Content-Type'] = f'multipart/form-data; boundary={boundary}'
        upload_headers['Origin'] = 'https://upload.facebook.com  '
        upload_headers['Referer'] = 'https://upload.facebook.com/  '
        upload_headers['X-FB-Friendly-Name'] = 'PhotoUpload'

        logger.info(f"[{request_id}] Sending photo upload request to Facebook")
        response = requests.post(UPLOAD_URL,
                                 headers=upload_headers,
                                 data=body,
                                 proxies=REQUESTS_PROXIES,
                                 verify=REQUESTS_VERIFY)

        logger.info(
            f"[{request_id}] Photo upload response status: {response.status_code}"
        )
        logger.info(f"[{request_id}] Response snippet: {response.text[:500]}")

        if response.status_code != 200:
            logger.error(
                f"[{request_id}] Photo upload failed with status {response.status_code}"
            )
            logger.error(f"[{request_id}] Response: {response.text[:500]}")
            return None

        try:
            clean_text = response.text.replace("for (;;);", "")
            json_match = re.search(r'{.*}', clean_text)
            if json_match:
                json_str = json_match.group()
                logger.info(
                    f"[{request_id}] Found JSON in response: {json_str[:500]}")
                response_data = json.loads(json_str)

                if 'payload' in response_data and 'photoID' in response_data[
                        'payload']:
                    photo_id = response_data['payload']['photoID']
                    logger.info(
                        f"[{request_id}] Successfully extracted photo ID: {photo_id}"
                    )
                    return photo_id
                else:
                    logger.error(
                        f"[{request_id}] Response structure doesn't match expected format"
                    )
                    logger.error(
                        f"[{request_id}] Response data: {response_data}")
            else:
                logger.error(f"[{request_id}] No JSON found in response")
                logger.error(f"[{request_id}] Response text: {clean_text}")

        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.error(
                f"[{request_id}] Error parsing photo upload response: {str(e)}"
            )
            logger.error(
                f"[{request_id}] Response text: {response.text[:500]}")

        return None

    except Exception as e:
        logger.exception(
            f"[{request_id}] Unexpected error in upload_photo: {str(e)}")
        return None


def create_post(group_id, content, photo_id=None, request_id=None):
    """Create a post in a Facebook group and return (success, post_url)"""
    try:
        variables = {
            "input": {
                "source": "WWW",
                "attachments": [],
                "message": {
                    "ranges": [],
                    "text": content
                },
                "inline_activities": [],
                "explicit_place_id": "0",
                "tracking": [None],
                "audience": {
                    "to_id": group_id
                },
                "actor_id": get_user_av_value(),
                "client_mutation_id": str(int(time.time()))
            }
        }

        if photo_id:
            variables["input"]["attachments"].append(
                {"photo": {
                    "id": photo_id
                }})

        boundary = "----WebKitFormBoundary" + "".join(
            [chr(i) for i in range(97, 123)]).replace(" ", "")[:16]

        payload = []

        payload.append(f"--{boundary}")
        payload.append("Content-Disposition: form-data; name=\"fb_dtsg\"")
        payload.append("")
        payload.append(get_user_fb_dtsg())

        payload.append(f"--{boundary}")
        payload.append("Content-Disposition: form-data; name=\"variables\"")
        payload.append("")
        payload.append(json.dumps(variables))

        payload.append(f"--{boundary}")
        payload.append("Content-Disposition: form-data; name=\"doc_id\"")
        payload.append("")
        payload.append("3559434960802556")

        payload.append(f"--{boundary}--")

        body = "\r\n".join(payload)

        post_headers = get_headers()
        post_headers['Host'] = 'www.facebook.com'
        post_headers[
            'Content-Type'] = f'multipart/form-data; boundary={boundary}'

        logger.info(f"[{request_id}] Creating post in group {group_id}")
        response = requests.post(GRAPHQL_URL,
                                 headers=post_headers,
                                 data=body.encode('utf-8'),
                                 proxies=REQUESTS_PROXIES,
                                 verify=REQUESTS_VERIFY)

        logger.info(
            f"[{request_id}] Facebook response status: {response.status_code}")
        logger.info(
            f"[{request_id}] Facebook response snippet: {response.text[:500]}")

        if response.status_code != 200:
            logger.error(
                f"[{request_id}] Post creation failed with status {response.status_code}"
            )
            logger.error(f"[{request_id}] Response: {response.text[:500]}")
            return False, None

        post_url = extract_post_url(response.text)

        try:
            clean_text = response.text.replace("for (;;);", "")
            response_data = json.loads(clean_text)
            logger.info(
                f"[{request_id}] Parsed response  {json.dumps(response_data)[:500]}"
            )

            if 'data' in response_data and 'story_create' in response_data[
                    'data']:
                if response_data['data'][
                        'story_create'] and 'story' in response_data['data'][
                            'story_create'] and 'id' in response_data['data'][
                                'story_create']['story']:
                    logger.info(
                        f"[{request_id}] Detected success via story_id")
                    return True, post_url

                if response_data['data']['story_create'] is not None:
                    logger.info(
                        f"[{request_id}] Detected partial success - story_create exists"
                    )
                    return True, post_url

            if 'errors' in response_data:
                error_messages = [
                    error.get('message', '')
                    for error in response_data['errors']
                ]
                logger.warning(
                    f"[{request_id}] Facebook returned warnings: {error_messages}"
                )

                non_fatal_warnings = [
                    'missing_required_variable_value', 'field_type_no_match',
                    'field_exception'
                ]

                all_non_fatal = True
                for msg in error_messages:
                    if not any(warning in msg
                               for warning in non_fatal_warnings):
                        all_non_fatal = False
                        break

                if all_non_fatal:
                    logger.info(
                        f"[{request_id}] All errors are non-fatal warnings, considering post successful"
                    )
                    return True, post_url

                logger.error(
                    f"[{request_id}] Facebook returned fatal errors: {error_messages}"
                )
                return False, None

            if 'data' in response_data and 'story_create' not in response_data[
                    'data']:
                logger.error(
                    f"[{request_id}] No story_create in response, indicating failure"
                )
                return False, None

            logger.info(f"[{request_id}] No errors detected, assuming success")
            return True, post_url

        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"[{request_id}] Error parsing response: {str(e)}")
            logger.error(f"[{request_id}] Raw response: {response.text[:500]}")

            if '<html' in response.text.lower():
                logger.error(
                    f"[{request_id}] Received HTML instead of JSON (likely login redirect)"
                )
                return False, None

            return False, None

    except Exception as e:
        logger.error(f"[{request_id}] Error creating post: {str(e)}",
                     exc_info=True)
        return False, None


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)
