FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base texlive-latex-recommended texlive-latex-extra \
    texlive-fonts-recommended texlive-fonts-extra-links lmodern \
    && rm -rf /var/lib/apt/lists/*
ENV openin_any=p openout_any=p TEXMFOUTPUT=/work HOME=/tmp
WORKDIR /work
