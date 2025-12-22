import zipfile
import xml.dom.minidom

def print_structure(node, indent=0):
    if node.nodeType == node.ELEMENT_NODE:
        # Limit depth or specific tags if output is too huge, but Arrangement should be manageable
        attrs = []
        if node.hasAttributes():
            for i in range(node.attributes.length):
                attr = node.attributes.item(i)
                attrs.append(f'{attr.name}="{attr.value}"')
        
        attr_str = " " + " ".join(attrs) if attrs else ""
        print("  " * indent + f"< {node.tagName}{attr_str}>")
        
        for child in node.childNodes:
            if child.nodeType == child.ELEMENT_NODE:
                print_structure(child, indent + 1)

def inspect_xml_structure(path, label):
    print(f"\n--- Structure of {label} ({path}) ---")
    try:
        with zipfile.ZipFile(path, 'r') as zip_ref:
            if 'project.xml' in zip_ref.namelist():
                with zip_ref.open('project.xml') as f:
                    content = f.read()
                    dom = xml.dom.minidom.parseString(content)
                    
                    # Find Arrangement
                    arrangement = dom.getElementsByTagName("Arrangement")
                    if arrangement:
                        print("Found Arrangement, showing structure...")
                        print_structure(arrangement[0])
                    else:
                        print("Arrangement not found.")
            else:
                print("project.xml NOT FOUND")
    except Exception as e:
        print(f"Error: {e}")

inspect_xml_structure('bank/storage/jotaro/test_ok.dawproject', 'OK Project')
inspect_xml_structure('bank/storage/jotaro/test_ng.dawproject', 'NG Project')
