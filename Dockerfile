FROM node:latest
RUN \
  # pip3 install requests && \
  apt-get update && \
  apt-get -y upgrade && \
  apt-get -y install \
      aptitude apt-utils \
      wget psmisc curl vim \
      debconf-utils dialog \
      apt-transport-https \
      libasound2 libatk-bridge2.0-0 libatspi2.0-0 \
      libatk1.0-0 libcairo2 libcups2 libexpat1 \
      libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
      libx11-xcb1 libxss1 libnspr4 libnss3 \
      gdb binutils xvfb cron \
  && \
  wget -P /tmp \
    https://ftp.opera.com/ftp/pub/opera-beta/62.0.3331.55/linux/opera-beta_62.0.3331.55_amd64.deb \
  && \
  mkdir /tmp/opera && \
  ls -al /tmp && \
  dpkg-deb -x /tmp/opera-beta_62.0.3331.55_amd64.deb /tmp/opera/ && \
  mv /tmp/opera/usr/lib/x86_64-linux-gnu/opera-beta /usr/local && \
  chmod 004 /usr/local/opera-beta/opera_autoupdate && \
  rm -f /tmp/opera-beta_62.0.3331.55_amd64.deb

