import requests
import datetime

# URL of the audio stream
audio_url = "https://s1-lhr.liveatc.net/kpao2_atis?nocache=2023091620583743575"

# Send an HTTP GET request to the URL
response = requests.get(audio_url, stream=True, timeout=10)

if response.status_code == 200:
    # Specify the file where you want to save the audio
    audio_filename = "audio_stream.mp3"  # You can change the filename and format

    t = datetime.datetime.now()
    # Open the file in binary write mode
    with open(audio_filename, 'wb') as audio_file:
        # Iterate through the response content in chunks and save to the file
        for chunk in response.iter_content(chunk_size=1024):
            if datetime.datetime.now()  - t > datetime.timedelta(minutes=1):
                break
            if chunk:
                audio_file.write(chunk)
    
    print("Audio downloaded successfully.")
else:
    print(f"Failed to download audio. Status code: {response.status_code}")
