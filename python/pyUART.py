"""
Created by Carl Gager
Updated: 3/16/2025

This program allows communication with a microcontroller or serial device via a specified COM port.
It listens for keypresses and sends predefined commands to the connected device. It also handles incoming serial data,
displaying it to the user.

The program allows for dynamic COM port selection or usage of a pre-defined COM port.
"""
import time
import keyboard
import serial
import serial.tools.list_ports

# Set this to a specific Com E.g. COM13 and it will use that every run, else if will find them all and ask.
COM = ""

# Create Commands that are used later to be sent on button press
pingCommand = [0xFF, 0x55, 0x56, 0x50, 0x05]


def get_serial_ports():
    """
    Retrieve a list of all available serial ports on the system.

    Returns:
        list: A list of available serial ports, as `serial.tools.list_ports.ComPortInfo` objects.
    """
    return serial.tools.list_ports.comports()


def list_serial_ports(ports):
    """
    Iterate through the list of serial ports and print the details of each port.

    Args:
        ports (list): A list of `serial.tools.list_ports.ComPortInfo` objects representing the available serial ports.
    """
    for port, desc, hwid in sorted(ports):
        print(f"{port}: {desc} [{hwid}]")
    print()


def validate_available_com(reset=False):
    """
    Validates and selects a COM port from the available serial ports. If `reset` is True,
    it will clear the previously selected COM port and prompt for a new selection.

    If a valid COM port is selected, it will start listening for keypresses and handle serial communication.

    Args:
        reset (bool): If True, resets the `COM` variable and prompts the user for a new COM port selection.
    """
    global COM
    if reset:
        COM = ""

    ports = get_serial_ports()

    list_serial_ports(ports)

    # Extract all available COM ports from the list
    available_ports = [port[0] for port in get_serial_ports()]  # Extract just the port names (e.g., "COM1", "COM2")

    while COM == "":
        selected = input("Please enter the COM port number (e.g., 1, 2): ").strip()

        # Prepend "COM" to the number entered by the user
        com_port = f"COM{selected}"

        if com_port in available_ports:
            COM = com_port
            print(f"Selected COM port: {COM}\n")
        else:
            print(f"Invalid COM port. Please select a valid port from the list.")
            list_serial_ports(ports)  # Show available ports again
    # COM is selected run
    listen_keypress(COM)


def listen_keypress(use_com):
    """
        Listens for keypresses while managing serial communication on the specified COM port.

        This function constantly checks if data is available on the serial port and prints it.
        It also listens for keypresses and sends predefined commands to the serial port based on the key pressed.

        Args:
            use_com (str): The COM port to use for serial communication.
        """
    try:
        ser = serial.Serial(use_com, 115200, timeout=1)
        print(f"Using {use_com}")
        
        while True:
            # Check if there is any data waiting in the buffer
            if ser.in_waiting > 0:
                # Read the data from the serial buffer
                response = ser.read(ser.in_waiting)

                byte_count = len(response)
                print(f"Number of bytes received: {byte_count}")

                # Using 'ignore' to skip any non-decodable bytes
                response_str = response.decode('utf-8', errors='ignore')

                # Split the response by the carriage return + newline sequence
                lines = response_str.split('\r\n')

                # Print each line on a new line
                for line in lines:
                    print(line)
            else:
                # Add functionality for key presses while the program is running
                if keyboard.is_pressed('1'):
                    ser.write(bytes(pingCommand))
                    print(f"Sent hex data: {pingCommand}")
                    time.sleep(0.1)  # Short delay to avoid multiple sends on a single press
                elif keyboard.is_pressed('2'):
                    ser.write(bytes(pingCommand))
                    print(f"Sent hex data: {pingCommand}")
                    time.sleep(0.1)  # Short delay to avoid multiple sends on a single press
                # elif keyboard.is_pressed('3'):
                #     # ser.write(bytes(pingCommand))
                #     print(f"Sent hex data: {pingCommand}")
                #     time.sleep(0.2)  # Short delay to avoid multiple sends on a single press
                # elif keyboard.is_pressed('4'):
                #     # ser.write(bytes(pingCommand))
                #     # print(f"Sent hex data: {pingCommand}")
                #     time.sleep(0.2)  # Short delay to avoid multiple sends on a single press
                # elif keyboard.is_pressed('5'):
                #     # ser.write(bytes(pingCommand))
                #     # print(f"Sent hex data: {pingCommand}")
                #     time.sleep(0.2)  # Short delay to avoid multiple sends on a single press
            # Sleep for a short while to avoid excessive CPU usage
            time.sleep(0.001)
    
    except serial.serialutil.SerialException as e:
        print(f"\nError: {e}")
        retry = input("Would you like to try another COM port?\n"
                      "Press Enter to exit, or type a new COM port number (Y)es (N)o: ").strip()
        if retry == "":
            exit()
        else:
            validate_available_com(reset=True)
    
    except KeyboardInterrupt:
        print("Exiting program")
    
    finally:
        # Close the serial connection if it's open
        if 'ser' in locals() and ser.is_open:
            ser.close()


def main():
    global COM
    
    if COM == "":
        print("No Default COM port selected, Searching and displaying available ports...")
        validate_available_com(reset=False)
    else:
        # Default COM set skip selection and run
        listen_keypress(COM)


if __name__ == "__main__":
    main()
