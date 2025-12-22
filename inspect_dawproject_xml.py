import zipfile
import re

def inspect_xml_content(path, label):
    print(f"--- Inspecting {label} ({path}) ---")
    try:
        with zipfile.ZipFile(path, 'r') as zip_ref:
            if 'project.xml' in zip_ref.namelist():
                with zip_ref.open('project.xml') as f:
                    content = f.read().decode('utf-8')
                    # Find Audio tags
                    matches = re.findall(r'(<Audio.*?</Audio>)', content, re.DOTALL)
                    if matches:
                        print(f"Found {len(matches)} Audio tags:")
                        for m in matches[:3]: # Show first 3
                            print(m)
                    else:
                        print("No <Audio> tags found via regex.")
                        # Fallback: print around "Audio"
                        idx = content.find("Audio")
                        if idx != -1:
                            print(f"Context around 'Audio':\n{content[max(0, idx-100):min(len(content), idx+200)]}")
            else:
                print("project.xml NOT FOUND")
    except Exception as e:
        print(f"Error: {e}")
    print("\n")

inspect_xml_content('bank/storage/jotaro/test_ok.dawproject', 'OK Project')
inspect_xml_content('bank/storage/jotaro/test_ng.dawproject', 'NG Project')

