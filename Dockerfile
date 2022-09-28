FROM rust:1.31

WORKDIR /usr/src/quartz
COPY . .

RUN cargo install --path .

CMD ["quartz"]