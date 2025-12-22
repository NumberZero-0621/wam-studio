import zipfile
import os

def inspect_dawproject(path, label):
    print(f"--- Inspecting {label} ({path}) ---")
    try:
        with zipfile.ZipFile(path, 'r') as zip_ref:
            # List files
            print("Files in archive:")
            for info in zip_ref.infolist():
                print(f"  {info.filename} ({info.file_size} bytes)")
            
            # Read project.xml
            if 'project.xml' in zip_ref.namelist():
                print("\nContent of project.xml (first 2000 chars):")
                with zip_ref.open('project.xml') as f:
                    content = f.read().decode('utf-8')
                    print(content[:2000])
            else:
                print("\nproject.xml NOT FOUND")

    except Exception as e:
        print(f"Error: {e}")
    print("\n")

inspect_dawproject('bank/storage/jotaro/test_ok.dawproject', 'OK Project')
inspect_dawproject('bank/storage/jotaro/test_ng.dawproject', 'NG Project')

