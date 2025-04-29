import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { MemoryRouter, NavigateFunction, Location, Params } from 'react-router-dom';
import * as router from 'react-router-dom';
import { ServicesView } from '../ServicesPage';
import { withRouter } from '../../../../utils/withRouter';
import { mockInitialProps } from './mocks';
import { mockAccounts } from '../../../../constants/mocks/mockAccounts';
import { mockPayloads } from '../../../../constants/mocks/mockPayloads';
import { mockServices } from '../../../../constants/mocks/mockServices';
import { defaultState } from '../../../../Redux/store';
import {
  networkFetchPayloads,
  networkFetchAccounts,
  networkFetchSvcGroups,
  networkFetchSvcs,
} from '../../../../utils/network';
import {
  createFetchActionCreator,
  addService,
  updateService,
  deleteService,
  removeGroupAccount,
  fetchServiceToken,
} from '../../../../Redux/actions/network';
import { closeErrorModal } from '../../../../Redux/actions/misc';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => delete store[key],
    length: 0,
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock Redux store
const mockStore = configureStore([]);

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => {
  const actualRouter = jest.requireActual('react-router-dom');
  return {
    ...actualRouter,
    useNavigate: jest.fn(),
    useLocation: jest.fn(),
    useParams: jest.fn(),
  };
});

// Mock network utils using jest.fn()
jest.mock('../../../../utils/network', () => ({
  networkFetchPayloads: jest.fn().mockImplementation(() => Promise.resolve([])),
  networkFetchAccounts: jest.fn().mockImplementation(() => Promise.resolve([])),
  networkFetchSvcGroups: jest.fn().mockImplementation(() => Promise.resolve([])),
  networkFetchSvcs: jest.fn().mockImplementation(() => Promise.resolve([])),
}));

// Mock Redux actions
jest.mock('../../../../Redux/actions/network', () => ({
  createFetchActionCreator: jest.fn().mockImplementation((typeArg) => {
    const types = {
      SERVICES: 'SERVICES/FETCH',
      ALLSERVICES: 'ALLSERVICES/FETCH',
      ACCOUNTS: 'ACCOUNTS/FETCH',
      GROUPS: 'GROUPS/FETCH',
      PAYLOADS: 'PAYLOADS/FETCH',
    };
    return () => ({ type: types[typeArg] });
  }),
  addService: jest.fn(),
  updateService: jest.fn(),
  deleteService: jest.fn(),
  removeGroupAccount: jest.fn(),
  fetchServiceToken: jest.fn(),
}));

// Mock the styles module
jest.mock('../ServicesPage.styles.ts', () => jest.fn(() => ({
  classes: {
    views: 'mock-views',
    servicesContainer: 'mock-services-container',
    booleanWrapper: 'mock-boolean-wrapper',
    greenAnswer: 'mock-green-answer',
    redAnswer: 'mock-red-answer',
  },
})));

// Initialize the mock store using defaultState and imported mocks
const store = mockStore({
  ...defaultState,
  servicesViewReducer: mockServices,
  accountsViewReducer: mockAccounts,
  linkedAccount: { account: null, groupId: '' },
  unlinkedAccount: { account: null, groupId: '' },
  services: mockServices,
  allservices: mockServices,
  bannerViewReducer: {
    banner: {
      timestamp: '2023-07-20T12:00:00Z',
      banner: 'System Maintenance Notice',
      warning: 'Security Alert: Critical Update Required',
      help_url: 'https://support.example.com',
    },
    isFetching: false,
  },
  payloads: mockPayloads,
});

const mockDispatch = jest.fn();
store.dispatch = mockDispatch;

// Define the initialProps as in the original setup
const initialProps = {
  ...mockInitialProps,
  closeErrorModal,
  fetchSvcs: networkFetchSvcs,
  fetchAllSvcs: networkFetchSvcs,
  fetchServiceToken,
  fetchAccounts: networkFetchAccounts,
  fetchGroups: networkFetchSvcGroups,
  fetchPayloads: networkFetchPayloads,
  addService,
  updateService,
  deleteService,
  removeGroupAccount,
};

describe('ServicesPage Component', () => {
  let mockNavigate: NavigateFunction;
  let mockLocation: Location;
  let mockParams: Readonly<Params<string>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNavigate = jest.fn();
    mockLocation = { pathname: '/services', search: '', hash: '', state: null, key: '' };
    mockParams = { svcId: '' };

    (router.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (router.useLocation as jest.Mock).mockReturnValue(mockLocation);
    (router.useParams as jest.Mock).mockReturnValue(mockParams);

    store.clearActions();
  });

  test('renders ServicesPage with the "Services" text in the first instance', () => {
    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...initialProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const servicesElements = screen.getAllByText(/Services/);
    expect(servicesElements[0]).toBeInTheDocument();
    expect(servicesElements[0]).toHaveTextContent('Services');
  });

  test('fetches services and accounts on mount', async () => {
    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    // Ensure fetchSvcs and fetchAccounts are called by mocking their resolved values
    networkFetchSvcs.mockResolvedValueOnce([]);
    networkFetchAccounts.mockResolvedValueOnce([]);

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...initialProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    // Wait for async effects to complete
    await screen.findByText(/Services/);

    expect(networkFetchSvcs).toHaveBeenCalledTimes(1);
    expect(networkFetchAccounts).toHaveBeenCalledTimes(1);
  });

  test('renders with empty services list', () => {
    const emptyProps = {
      ...initialProps,
      services: { items: [], isFetching: false },
      allservices: { items: [], isFetching: false },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...emptyProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const servicesElements = screen.getAllByText(/Services/);
    expect(servicesElements[0]).toBeInTheDocument();
    expect(screen.queryByText(/SB_DB_RND/i)).not.toBeInTheDocument();
  });

  test('navigates to service details on mount with svcId', async () => {
    const mockService = { svc_id: 254, name: 'Test Service' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService],
        isFetching: false,
      },
    };

    (router.useParams as jest.Mock).mockReturnValue({ svcId: '254' });

    const routerProps = {
      navigate: mockNavigate,
      location: { ...mockLocation, pathname: '/services' },
      params: { svcId: '254' },
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter initialEntries={['/services']}>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    // Wait for async effects to complete
    await screen.findByText(/Services/);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/services/254');
  });

  test('filters services when typing in the search input', async () => {
    const mockService1 = { svc_id: 1, name: 'Service A' };
    const mockService2 = { svc_id: 2, name: 'Service B' };
    const updatedProps = {
      ...initialProps,
      services: {
        items: [mockService1, mockService2],
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Filter services/i);
    fireEvent.change(searchInput, { target: { value: 'Service A' } });

    const filteredServices = screen.getAllByText(/Service A/i);
    expect(filteredServices[0]).toBeInTheDocument();
    expect(screen.queryByText(/Service B/i)).not.toBeInTheDocument();
  });

  test('paginates services when clicking the next button', async () => {
    const mockServicesList = Array.from({ length: 15 }, (_, i) => ({
      svc_id: i + 1,
      name: `Service ${i + 1}`,
    }));
    const updatedProps = {
      ...initialProps,
      services: {
        items: mockServicesList,
        isFetching: false,
      },
    };

    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...updatedProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const nextButton = screen.getByText(/Next/i);
    fireEvent.click(nextButton);

    expect(screen.getByText(/Page 2/i)).toBeInTheDocument();
  });

  test('initiates adding a new service when clicking add button', () => {
    const routerProps = {
      navigate: mockNavigate,
      location: mockLocation,
      params: mockParams,
    };

    const ServicesViewWithRouter = withRouter(() => (
      <Provider store={store}>
        <ServicesView {...initialProps} routerProps={routerProps} />
      </Provider>
    ));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    const addButton = screen.getByText(/Add Service/i);
    fireEvent.click(addButton);

    expect(mockNavigate).toHaveBeenCalledWith('/services/add');
  });
});
