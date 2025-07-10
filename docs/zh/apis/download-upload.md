# 在Airalogy Protocol中下载或上传Airalogy平台托管的云端数据

## File

在Airalogy平台中，允许用户上传各种文件，包括但不限于图片、视频、音频和其他文件，这些上传后的文件在Airalogy平台中被储存于云端，每个文件都会被分配一个唯一的Airalogy File ID。Airalogy File ID具有如下格式：

```txt
airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.yyy
```

其中，`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`是一个UUID，`yyy`是文件的后缀名。

### 下载和上传文件

每个文件都可以以二进制（bytes）或者Base64的形式进行下载和上传。

```py
from airalogy import Airalogy

# 初始化客户端需要设置环境变量
# 必需的环境变量：
# - AIRALOGY_ENDPOINT
# - AIRALOGY_API_KEY
# - AIRALOGY_PROTOCOL_ID
# 在本地运行/测试的时候需要设置这些环境变量
# os.environ["AIRALOGY_ENDPOINT"] = "http://localhost:4000"
# os.environ["AIRALOGY_API_KEY"] = "xxx"
# os.environ["AIRALOGY_PROTOCOL_ID"] = "airalogy.id.lab.lab1.project.proj1.protocol.protocol1.v.0.0.1"
airalogy_client = Airalogy()

# 下载
file_bytes: bytes = airalogy_client.download_file_bytes(
    file_id = "airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.yyy" # 每种类型的文件对象都有结构一致的ID，因此所有文件对象都可以用同样的指令进行下载
)

file_base64: str = airalogy_client.download_file_base64(
    file_id = "airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.yyy" 
)

# 上传
file = airalogy_client.upload_file_bytes( 
    file_name = "xxx.yyy", # .yyy是文件的后缀名，必须要有后缀名，因为其将用于ID的生成
    file_bytes = file_bytes
)
# 每个文件上传至Airalogy平台后，都会被分配一个唯一的Airalogy File ID，这个ID可以用来下载文件，也可以用来删除文件
# 如果要获得上传后的Airalogy File ID，可以使用下面的指令
# 上传后会返回一个File字典，其中包含了文件的ID。本设计参考了`openai`的API设计。之所以要返回一个File字典，是因为未来可能会增加更多的文件属性，例如文件的大小、上传时间等
# 返回的file字典包含：
# {
#     "id": "airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.yyy",
#     "file_name": "xxx.yyy"
# }
file_id = file["id"]

file = airalogy_client.upload_file_base64(
    file_name = "xxx.yyy",
    file_base64 = file_base64
)
```

### 获取临时文件URL

在有的时候当我们在Airalogy平台上上传了一个文件后，我们可能需要获取这个文件的临时URL，可以使用以下代码：

```py
from airalogy import Airalogy
airalogy_client = Airalogy()

file_id = "airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.yyy"
# 获取临时文件URL
file_url: str = airalogy_client.get_file_url(
    file_id = file_id,
)
```

对于上传至Airalogy平台上私有Airalogy Protocol中的文件，该URL的有效期为24小时。

## Record

在Airalogy平台中，每条Airalogy Record都被分配一个唯一的Airalogy Record ID。Airalogy Record ID具有如下格式：

```txt
airalogy.id.record.<UUID>.v.<version_number>
```

### 下载多条Airalogy Records

```py
from airalogy import Airalogy

airalogy_client = Airalogy()

records_json: str = airalogy_client.download_records_json( 
    record_ids = [
        "airalogy.id.record.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx1.v.1",
        "airalogy.id.record.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx1.v.2",
        "airalogy.id.record.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx2.v.1",
    ]
)
# records_json为字符串形式的JSON，其格式如下：
# [
#     {
#         ...
#     },
#     {
#         ...
#     },
#     ...
# ]
```

下载后的Records以JSON字符串的形式返回，用户为了获取Records的内容，可以将其转换为Python的字典：

```py
import json

records: list[dict] = json.loads(records_json)
```
