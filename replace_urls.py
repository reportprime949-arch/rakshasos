import os

old_urls = [
    "https://backend-server.vercel.app",
    "http://backend-server.vercel.app",
    "http://localhost:3000",
    "https://localhost:3000",
    "http://localhost:4000",
    "http://https://rakshasos-backend.onrender.com",
    "http://127.0.0.1",
    "ws://localhost:3000",
    "ws://rakshasos-backend.onrender.com"
]

new_url = "https://rakshasos-backend.onrender.com"
new_ws_url = "wss://rakshasos-backend.onrender.com"

def replace_in_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        for old in old_urls:
            if "ws://" in old:
                content = content.replace(old, new_ws_url)
            else:
                content = content.replace(old, new_url)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated: {file_path}")
    except Exception as e:
        pass

for root, dirs, files in os.walk('.'):
    if 'node_modules' in dirs:
        dirs.remove('node_modules')
    if '.git' in dirs:
        dirs.remove('.git')
    if '.next' in dirs:
        dirs.remove('.next')
    
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.env', '.env.production')):
            replace_in_file(os.path.join(root, file))
