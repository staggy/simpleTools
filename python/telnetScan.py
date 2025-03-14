"""
Carl Gager
Quick and simple Telnet Scanner
"""
import socket
import ipaddress

# Default to bypass user typing network 
# modify to your current private local IP address ranges
# 10.0.0.0/24
# 172.16.0.0/24
default_network_adr = "192.168.1.0/24"

def check_telnet(ip, port=23, timeout=1):
    """Checks if a Telnet port is open on a given IP address."""
    try:
        socket.setdefaulttimeout(timeout)
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((str(ip), port))
        s.shutdown(socket.SHUT_RDWR)
        return True
    except Exception:
        return False
    finally:
        s.close()

def scan_network(network, start_ip_suffix, end_ip_suffix):
     """Scans a network range for open Telnet ports."""
     for ip_int in range(start_ip_suffix, end_ip_suffix + 1):
        print(f"checking {str(network).rsplit('.', 1)[0]}.{ip_int}")
        ip_address = network[ip_int]
        if check_telnet(ip_address):
            print(f"Telnet is open on {ip_address}")

if __name__ == "__main__":
    network_address = input("Enter the network address (e.g., 192.168.1.0/24): ")
    if network_address == "":
        network_address = default_network_adr
    
    try:
        start_ip_suffix = int(input("Enter the starting IP suffix (e.g., 1): "))
    except ValueError:
        print(f"No value entered starting with default value of 1")
        start_ip_suffix = 1
    
    try:
        end_ip_suffix = int(input("Enter the ending IP suffix (e.g., 254): "))
    except ValueError:
        print(f"No value ending with default value of 255")
        end_ip_suffix = 254

    try:
        network = ipaddress.ip_network(network_address)
        scan_network(network, start_ip_suffix, end_ip_suffix)
    except ValueError:
        print("Invalid network address.")