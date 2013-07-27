if [ -d nbc ] ; then
  echo "nbc already installed. Setting PATH and exiting. To reinstall, delete ./nbc directory"
  export PATH=$PATH:$(pwd)/nbc/NXT
else
  mkdir nbc
  cd nbc
  curl -L -s http://downloads.sourceforge.net/bricxcc/nbc-1.2.1.r4.osx.tgz | tar zx
  export PATH=$PATH:$(pwd)/NXT
  cd ..
fi

