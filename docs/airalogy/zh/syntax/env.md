# 环境变量

某些Airalogy Protocol Assigner需要使用一些环境变量才能正常运行（例如用于访问外部大模型的`API_KEY`或用于访问外部数据库的`DATABASE_URL`）。这些环境变量通常保存在Protocol文件夹下的`.env`文件中。

其文件结构如下：

```txt
protocol/
├── protocol.aimd
├── model.py
├── assigner.py
└── .env
```

```env
API_KEY=your_api_key
DATABASE_URL=your_database_url
```

当这些环境变量被写入`.env`文件后，该Airalogy Protocol被打包上传[Airalogy平台](https://airalogy.com)时，为了保证`.env`文件中机密信息的安全性，用户在上传Protocol后，平台会自动删除云端Protocol中的`.env`文件，而平台会自动读取这些环境变量并保存到云端Protocol的环境变量配置中，并在用户运行Protocol时，自动将这些环境变量加载并注入到运行时环境中。

当然，为了告知其他开发者这些环境变量的存在，用户可以在Protocol中额外添加一个`.env.example`文件，列出所有需要的环境变量及其示例值。

```txt
protocol/
├── protocol.aimd
├── model.py
├── assigner.py
├── .env
└── .env.example
```

```env
API_KEY=your_api_key
DATABASE_URL=your_database_url
```

这个`.env.example`文件并不会被平台删除，其他开发者可以通过查看该文件了解需要配置哪些环境变量。

## 请勿使用`dotenv`库

需要注意的是，通常在本地代码环境下，用户经常通过使用`dotenv`库来加载`.env`文件中的环境变量，例如：

```python
from dotenv import load_dotenv
import os
load_dotenv()
API_KEY = os.getenv("API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
```

但出于安全考虑，在Airalogy平台中，不允许Protocol代码直接使用`dotenv`库来加载`.env`文件。平台会自动处理这些环境变量的加载和注入，因此用户只需在Protocol代码中直接使用`os.getenv()`或其他方式获取环境变量即可。

因此，请注意，请勿在Protocol代码中使用`dotenv`库。否则含有`dotenv`库的Protocol会被拒绝上传到Airalogy平台。

取而代之的，用户在本地测试Protocol时，可以采用以下2种方式来加载环境变量：

1. 直接在本地运行时终端中设置环境变量，例如：

   ```bash
   export API_KEY=your_api_key
   export DATABASE_URL=your_database_url
   ```

   然后直接在Python代码中使用`os.getenv()`获取这些环境变量：

   ```python
   import os
   API_KEY = os.getenv("API_KEY")
   DATABASE_URL = os.getenv("DATABASE_URL")
   ```

2. 在本地Protocol代码中使用`dotenv`库加载`.env`文件，但请确保在上传到Airalogy平台时删除该库的引用。
