# Simulated nvm: spends its time the way the real one does, loading before it is needed.
nvm_auto() { sleep 0.06; }
sleep 0.22
nvm_auto
