# Forma · Apartamento 3D

Editor local de interiores com maquete 3D, planta 2D, visão interna, chat conectado ao Codex e histórico de versões. O projeto inicial reproduz a unidade **Ponta de 36,15 m², dois dormitórios**, da página 11 do book HM Smart Barra Funda.

## Iniciar

Requisitos: **Node.js 24.5+**, **pnpm 10** e **Codex CLI 0.154.0 ou posterior compatível com o protocolo experimental de ferramentas dinâmicas**.

```sh
pnpm install
pnpm dev
```

Abra **http://127.0.0.1:5173**. Um comando inicia o frontend e o backend, ambos restritos ao computador local. O backend usa a porta 4310.

Para usar uma versão compilada:

```sh
pnpm build
pnpm start
```

Nesse caso, abra **http://127.0.0.1:4310**. Pare o servidor de desenvolvimento antes de iniciar a versão compilada na mesma porta.

## Conexão com o ChatGPT

O Forma inicia um processo `codex app-server --stdio`, usando o login gerenciado pelo próprio Codex. Não lê nem copia tokens de autenticação para o navegador. Uma conta já autenticada no CLI pode ser reconhecida automaticamente; se necessário, clique no avatar e em **Entrar com ChatGPT**, ou execute `codex login` antes de iniciar o app.

A lista de modelos vem de `model/list`. **Astra (`gpt-6-astra`)** é recomendado quando disponível. Se não estiver disponível, escolha outro modelo no seletor; não há substituição silenciosa.

O uso consome os limites/créditos da conta e do workspace conectado. Uma assinatura ativa não elimina os limites específicos do workspace. Em caso de saldo esgotado, o editor continua funcionando e o pedido não muda a cena. Reponha os créditos e envie novamente. Não há integração com API faturada separadamente nesta versão.

Referência do protocolo: [Codex App Server](https://learn.chatgpt.com/docs/app-server). As ferramentas dinâmicas são experimentais; mudanças futuras no CLI podem exigir atualização do adaptador.

## Usar o editor

- **Móveis:** adicione uma peça no cômodo escolhido. Selecione-a no 3D para editar posição, rotação, dimensões em centímetros e materiais por parte. Os controles na cena permitem mover, girar e redimensionar.
- **Estilos:** aplique um dos cinco estilos ao apartamento ou ao cômodo selecionado. Objetos bloqueados são preservados.
- **Inspirações:** guarde imagens e selecione referências no chat. As peças são aproximações paramétricas, não cópias exatas de produtos de lojas.
- **Chat:** o cômodo e o objeto selecionados acompanham o pedido. Uma captura da cena e os anexos selecionados são enviados ao modelo. Enter envia; Shift+Enter adiciona uma linha. Cada pedido aplicado gera uma versão.
- **Detalhes:** também oferece iluminação e preferências persistentes para a IA, como materiais favoritos, rotina e restrições.
- **Histórico:** renomeie uma versão clicando no título, restaure ou compare duas cenas. A comparação sincroniza as câmeras ao terminar a interação. Restaurar cria uma nova versão e conserva as alternativas anteriores.
- **Atalhos:** ⌘/Ctrl+Z desfaz; ⌘/Ctrl+Shift+Z refaz. Na visão interna, W/A/S/D ou as setas deslocam a câmera. Escape limpa a seleção/comparação.
- **Editar planta:** libera ajustes de paredes, pontos, ambientes e aberturas. A calibração aplica uma razão entre uma medida existente no modelo e uma medida real. Móveis mantêm suas dimensões físicas.
- **Exportar:** imagem PNG da câmera atual ou arquivo `.forma` com cena, versões, mensagens e anexos. Reimporte pelo menu do projeto.

### Importar outra planta

Clique em **Planta**, selecione PNG, JPEG ou PDF de até 20 MB. Para PDF, escolha a página. Arraste um retângulo sobre a imagem para recortar apenas a unidade desejada. Informe a área de referência e, se conhecida, a largura total do recorte.

A IA propõe a geometria. Na revisão, confira a sobreposição da imagem, arraste os pontos e ajuste numericamente paredes, cômodos, portas e janelas. Só ao clicar em **Criar projeto 3D** nasce um novo projeto. A análise visual exige créditos disponíveis; o projeto existente não é substituído.

## Medidas e representação

O book é ilustrativo e não contém cotas horizontais. A base HM usa proporções estimadas, com pé-direito documentado de **2,60 m**, reduzido a **2,35 m no banheiro/lavatório**. A área declarada de 36,15 m² não é tratada como uma medição confirmada de área útil. A renderização é uma maquete editável, não um desenho executivo ou imagem fotorrealista.

O modelo inicial mantém a distribuição do book: cozinha/serviço e entrada na parte superior, banheiro à direita, quarto de solteiro à esquerda, sala central e quarto de casal à direita. Instalações fixas começam bloqueadas para alterações pela IA.

## Persistência e arquitetura

```text
apps/web       React, Vite, Zustand, Radix e Three.js/React Three Fiber
apps/server    Fastify, SQLite, fila persistente, SSE e adaptador Codex
packages/domain  Schema da cena, comandos, validação, catálogo e planta inicial
tests          Testes de domínio, persistência e integração HTTP
data           Dados locais (fora do controle de versão)
```

- `SceneDocument` usa metros, graus e identificadores estáveis. Seu `schemaVersion` permite evolução explícita do formato.
- `SceneOperation` é validada por Zod e aplicada tanto na edição manual quanto na IA. Erros não produzem uma cena parcialmente alterada.
- Cada `SceneRevision` preserva snapshot, operações, miniatura, origem e ancestral. Conflitos com uma revisão mais recente são recusados.
- SQLite usa WAL e migrações versionadas. Anexos ficam em arquivos identificados por UUID, e as consultas são parametrizadas.
- A fila executa um pedido por vez. Cancelamento, falha do provedor e reinício preservam a última cena válida. Pedidos interrompidos são sinalizados e podem ser reenviados.
- O modelo recebe a versão atual como fonte de verdade e conversas relacionadas a ela. Preferências explícitas sobrevivem às restaurações.
- `DesignAgent` separa o domínio do transporte da IA. Testes injetam um provedor controlado; a aplicação normal usa exclusivamente o Codex real.
- Credenciais são geridas pelo Codex. O servidor valida Host, origem e sessão. Ferramentas de shell, navegação, conectores, plugins e subagentes são desativadas na sessão de design; somente operações validadas do editor podem modificar a cena.

O formato da cena e a separação entre armazenamento, domínio e agente permitem uma futura migração para backend remoto. Esta versão é individual e local; não oferece sincronização, contas multiusuário, colaboração simultânea, pagamentos ou publicação online.

### Dados e configuração

`data/forma.sqlite` contém os projetos; `data/attachments/`, as referências. Faça backup da pasta `data` com o app parado, ou use a exportação de projeto.

Configurações opcionais no ambiente do processo:

| Variável         | Uso                                                    |
| ---------------- | ------------------------------------------------------ |
| `FORMA_DATA_DIR` | Diretório de dados, padrão `./data`                    |
| `CODEX_BIN`      | Caminho do executável Codex, padrão `codex`            |
| `PORT`           | Porta do backend, padrão `4310`; o proxy Vite usa 4310 |

O PDF da construtora permanece como arquivo de entrada local.

## Verificação

```sh
pnpm test
pnpm check
pnpm build
```

Os testes cobrem o modelo HM, operações atômicas, restrições da IA, estilos por cômodo, calibração, outra topologia, histórico, conflitos, reinício, exportação/importação, validação de anexos, sessão/origem, fila, cancelamento e erros de créditos.

Os testes de integração de geração usam um **provedor de teste**, isolado dos dados reais. Eles validam os fluxos de aplicação e importação; não comprovam a precisão da interpretação visual de um modelo real. Consulte `VALIDATION.md` para o resultado da validação desta entrega.
