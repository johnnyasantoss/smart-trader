#!/usr/bin/env python3

import codecs
import csv
import sqlite3
import sys
from datetime import datetime
from os import path


def verificar_arquivos(arquivo_csv, arquivo_db):
    """
    Verifica se todos os arquivos necessário existem
    """
    if not path.isfile(arquivo_csv):
        raise Exception('Não foi encontrado o arquivo CSV')
    if not path.isfile(arquivo_db):
        raise Exception('Não foi encontrado o arquivo do banco de dados')


def salvar_info_db(conteudo, arquivo_db):
    conteudo_db = converter_dados_db(conteudo)

    conexao = sqlite3.connect(database=arquivo_db)
    with conexao:
        print('Conectado! {0}'.format(arquivo_db))
        cursor = conexao.cursor()

        tabela = garantir_existencia_tabela(cursor)

        interrogacoes = ', '.join(('?' for x in tabela['colunas']))
        colunas = ', '.join(('`{}`'.format(x) for x in tabela['colunas']))

        comando_varios = 'INSERT OR REPLACE INTO `{0}` ({1}) VALUES ({2});'.format(
            tabela['nome'], colunas, interrogacoes)
        print(comando_varios)

        cursor.executemany(comando_varios, conteudo_db)

        print('Inserido {0} linhas'.format(len(conteudo)))

        conexao.commit()


def converter_dados_db(conteudo):
    if not type(conteudo) == type([]):
        raise Exception('Tipo inválido de informacão para armazenar no banco')

    print('Convertendo dados...')

    conteudo_db = list(
        tuple([
            linha['OrderUuid'],
            linha['Exchange'],  # Esse é na verdade o Par
            'Bittrex',
            1 if linha['Type'] == 'LIMIT_BUY' else 2,
            float(linha['Quantity']),
            float(linha['Limit']),
            float(linha['CommissionPaid']),
            datetime.strptime(linha['Opened'], '%m/%d/%Y %I:%M:%S %p'),
            datetime.strptime(linha['Closed'], '%m/%d/%Y %I:%M:%S %p')
        ]) for linha in conteudo)

    return conteudo_db


def garantir_existencia_tabela(cursor):
    nome_tabela = 'Orders'
    colunas = [
        'Id', 'Pair', 'Exchange', 'Type', 'Quantity', 'Limit', 'CommissionPaid',
        'OpenDate', 'CloseDate'
    ]
    comando_criacao_tabela = """CREATE TABLE IF NOT EXISTS"{0}" (
    `{1[0]}` TEXT NOT NULL,
    `{1[1]}` TEXT NOT NULL,
    `{1[2]}` TEXT NOT NULL,
    `{1[3]}` INTEGER NOT NULL,
    `{1[4]}` REAL NOT NULL,
    `{1[5]}` REAL NOT NULL,
    `{1[6]}` REAL NOT NULL,
    `{1[7]}` TEXT NOT NULL,
    `{1[8]}` TEXT,
    PRIMARY KEY(`Id`)
)""".format(nome_tabela, colunas)

    print('Criando tabela...')
    cursor.execute(comando_criacao_tabela)

    return {'colunas': colunas, 'nome': nome_tabela}


def importar_informacao_csv(arquivo_csv):
    with codecs.open(arquivo_csv, mode='rb', encoding='utf-16le') as conteudo_csv:
        leitor = csv.DictReader(conteudo_csv, delimiter=',')

        print('Lendo {0} colunas {1}'.format(
            len(leitor.fieldnames), leitor.fieldnames))

        qtd_linhas = 0
        conteudo = []

        for linha in leitor:
            qtd_linhas += 1
            conteudo.append(linha)

        print('Lido {0} linhas.'.format(qtd_linhas))

        return conteudo


def main():
    """
    Funcão principal
    """

    if not len(sys.argv) == 3 or sys.argv[1] == '-h':
        print("""Script de importacão de dados do Bittrex

-h\tMostra essa ajuda

Forma de uso:
\t{0} arquivo.csv db.sqlite3""".format(__file__))
        sys.exit(1)

    # verifica se os arquivos existem
    arquivo_csv = sys.argv[1]
    arquivo_db = sys.argv[2]
    verificar_arquivos(arquivo_csv, arquivo_db)

    conteudo = importar_informacao_csv(arquivo_csv)

    salvar_info_db(conteudo, arquivo_db)


if __name__ == '__main__':
    main()
