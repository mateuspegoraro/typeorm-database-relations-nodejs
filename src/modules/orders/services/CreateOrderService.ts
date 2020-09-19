import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('Cliente não encontrado');
    }

    const existingProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existingProducts.length) {
      throw new AppError('Produtos não foram encontrados');
    }

    const existingProductsIds = existingProducts.map(p => p.id);

    const checkInexistentProducts = products.filter(
      p => !existingProductsIds.includes(p.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Produto não encontrado com o id ${checkInexistentProducts[0].id}`,
      );
    }

    const findProductsWithNoQuantity = products.filter(
      product =>
        existingProducts.filter(p => p.id === product.id)[0].quantity <=
        product.quantity,
    );

    if (findProductsWithNoQuantity.length) {
      throw new AppError(
        `Produto de id ${findProductsWithNoQuantity[0].id} não possui quantidade suficiente (${findProductsWithNoQuantity[0].quantity})`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existingProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    const orderProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        existingProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
