# 命名管道通信

命名管道通过网络来实现进程之间的通信，不仅可以在本机的两个进程之间进行通信，还可以实现跨越网络的进程之间的通信。命名管道通信以连接的方式来进行，服务器创建命名管道对象，并在此对象上等待请求。客户端连接过来之后，二者都可以通过命名管道进行读写。

命名管道提供了两种通信模式：字节模式和消息模式。字节模式将数据流以连续的字节流的形式在C和S之间传输;消息模式下C和S通过不连续的数据单位作为消息进行数据的收发。

## 命名管道通信：服务端

服务端的进程首先创建命名管道。创建命名管道函数：

  HANDLE WINAPI CreateNamedPipe(
    _In_     LPCTSTR               lpName,
    _In_     DWORD                 dwOpenMode,
    _In_     DWORD                 dwPipeMode,
    _In_     DWORD                 nMaxInstances,
    _In_     DWORD                 nOutBufferSize,
    _In_     DWORD                 nInBufferSize,
    _In_     DWORD                 nDefaultTimeOut,
    _In_opt_ LPSECURITY_ATTRIBUTES lpSecurityAttributes
  );
  

## 命名管道通信：服务端
