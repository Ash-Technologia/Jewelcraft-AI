import sys

file_path = 'c:/Users/user/OneDrive/Desktop/Jewel-AI/frontend/src/components/agent/AgentPanel.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    data = f.read()

# exact string replacements
data = data.replace(
    '< span key = { i } className = "agent-typing-dot" style = {{ animation: `waveform 0.8s ${delay}s ease-in-out infinite` }} />',
    '<span key={i} className="agent-typing-dot" style={{ animation: `waveform 0.8s ${delay}s ease-in-out infinite` }} />'
)

data = data.replace(
    '< span key = { i } className = "waveform-bar" style = {{ animationDelay: `${delay}s` }} />',
    '<span key={i} className="waveform-bar" style={{ animationDelay: `${delay}s` }} />'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(data)

print("Python script: AgentPanel.tsx string replacement successful.")
